#!/usr/bin/env python3
"""Chromium smoke/regression tests for the offline Tameshk app shell.

Requires Python Playwright and a Chromium binary. Local browser navigation is
not required: local app scripts/styles are embedded as data URLs and localStorage
is replaced with a per-page in-memory implementation for this isolated test.
"""
from __future__ import annotations
import base64
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

APP_DIR = Path(__file__).resolve().parents[1] / "resources" / "app"
CHROMIUM = os.environ.get("TAMESHK_CHROMIUM", "/usr/bin/chromium")


def browser_html(seed_state_json: str | None = None, widget_route: str | None = None, widget_record: str | None = None) -> str:
    html = (APP_DIR / "index.html").read_text(encoding="utf-8")
    script_re = re.compile(r'<script\b([^>]*?)\bsrc=["\']([^"\']+)["\']([^>]*)>\s*</script>', re.I)

    def inline_script(match: re.Match[str]) -> str:
        src = match.group(2)
        path = (APP_DIR / src.split("?")[0].removeprefix("./")).resolve()
        if not path.is_file() or APP_DIR.resolve() not in path.parents:
            return match.group(0)
        source = path.read_bytes()
        # For tests only, mount the real desktop-widget route while set_content
        # stays on about:blank (the managed browser blocks localhost/file URLs).
        if path.name == "desktop-widget.js" and widget_route:
            text = source.decode("utf-8")
            text = text.replace(
                "const u=new URL(location.href),toolbarRoute=u.searchParams.get('tameshkWidget'),panel=u.searchParams.get('tameshkPanel');",
                "const u=new URL(location.href),toolbarRoute=u.searchParams.get('tameshkWidget'),panel=u.searchParams.get('tameshkPanel')||window.__TAMESHK_TEST_WIDGET_ROUTE;",
            )
            text = text.replace(
                "const id=new URL(location.href).searchParams.get('record');root.showInvoice?.(id,new URL(location.href).searchParams.get('editable')==='1');ensureInvoiceOptions(id)",
                "const id=new URL(location.href).searchParams.get('record')||window.__TAMESHK_TEST_WIDGET_RECORD;root.showInvoice?.(id,new URL(location.href).searchParams.get('editable')==='1');ensureInvoiceOptions(id)",
            )
            source = text.encode("utf-8")
        payload = base64.b64encode(source).decode("ascii")
        attrs = (match.group(1) + " " + match.group(3)).strip()
        attrs = re.sub(r"\s+(?:defer|async)(?=\s|$)", "", attrs, flags=re.I)
        return f'<script {attrs} src="data:text/javascript;base64,{payload}"></script>'

    html = script_re.sub(inline_script, html)
    css_re = re.compile(r'<link\b([^>]*?)\bhref=["\']([^"\']+\.css(?:\?[^"\']*)?)["\']([^>]*)>', re.I)

    def inline_css(match: re.Match[str]) -> str:
        href = match.group(2)
        path = (APP_DIR / href.split("?")[0].removeprefix("./")).resolve()
        if not path.is_file() or APP_DIR.resolve() not in path.parents:
            return match.group(0)
        payload = base64.b64encode(path.read_bytes()).decode("ascii")
        return f'<link {match.group(1)} href="data:text/css;base64,{payload}" {match.group(3)}>'

    html = css_re.sub(inline_css, html)
    seed = f"m.set('tameshk-state',{json.dumps(seed_state_json)});" if seed_state_json is not None else ""
    widget_boot = ""
    if widget_route:
        widget_boot = f"window.__TAMESHK_TEST_WIDGET_ROUTE={json.dumps(widget_route)};window.__TAMESHK_TEST_WIDGET_RECORD={json.dumps(widget_record or '')};"
    storage_shim = f"<script>{widget_boot}(()=>{{const m=new Map();{seed}Object.defineProperty(window,'localStorage',{{configurable:true,value:{{getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear(),key:i=>Array.from(m.keys())[i]||null,get length(){{return m.size}}}}}})}})()</script>"
    return html.replace("</head>", storage_shim + "</head>")


def main() -> int:
    html = browser_html()
    failures: list[str] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=CHROMIUM,
                                     args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page()
        page_errors: list[str] = []
        page.on("pageerror", lambda error: page_errors.append(str(error)))
        page.set_content(html, wait_until="load", timeout=60_000)
        page.wait_for_timeout(800)

        # A13: current-format records store total discount in exactTotals.discount.
        result = page.evaluate("""(() => {
          const c=window.TameshkCurrency.config();
          const tx={id:'qa-a13',no:'QA-A13',date:new Date().toISOString().slice(0,10),currency:c.currency,currencyDecimals:c.currencyDecimals,
            discount:10,items:[{name:'QA service',qty:1,price:100,lineDiscount:10}],
            exactTotals:{subtotal:100,lineDiscount:10,discount:10,taxable:90,tax:0,total:90}};
          state.transactions=[tx];
          return {discount:reportData().discount};
        })()""")
        if result["discount"] != 10:
            failures.append(f"A13: expected report discount 10, got {result['discount']}")
        else:
            print("PASS A13: report discount = 10 (not double-counted)")

        # R1: returned sales reduce period/dashboard aggregates, while the original
        # transaction remains an unchanged historical source record.
        return_page = browser.new_page()
        return_errors: list[str] = []
        return_page.on("pageerror", lambda error: return_errors.append(str(error)))
        return_page.set_content(browser_html(), wait_until="load", timeout=60_000)
        return_page.wait_for_timeout(500)
        return_check = return_page.evaluate("""()=>{
          closeModal();document.getElementById('profileOverlay')?.remove();
          const day=new Date().toISOString().slice(0,10),c=TameshkCurrency.config();
          const sale={id:'qa-return-source',no:'QA-RETURN',date:day,dateCalendar:'میلادی',currency:c.currency,currencyDecimals:c.currencyDecimals,customer:'QA return',discount:0,taxOn:false,items:[{name:'QA returned item',qty:1,price:100}],exactTotals:{subtotal:100,lineDiscount:0,discount:0,taxable:100,tax:0,total:100}};
          state.transactions=[sale];state.expenses=[];state.products=[];
          state.transactionReturns=[{id:'qa-return-adjustment',transactionId:sale.id,lineIndex:0,quantity:0.3,refundAmount:30,returnDate:day,currency:c.currency,currencyDecimals:c.currencyDecimals}];
          const before=JSON.stringify(sale);go('dashboard');
          const cards=[...document.querySelectorAll('.grid.stats .stat .value')];
          const dashboardIncome=cards[0]?.textContent.trim(),dashboardProfit=cards[2]?.textContent.trim();
          const weeklyValues=[...document.querySelectorAll('.week-series.sale .week-amount')].map(x=>x.textContent.trim());
          go('reports');
          for(const id of ['reportFrom','reportTo']){const input=document.getElementById(id);input.dataset.iso=day;input.value=TameshkCalendar.format(day,input.dataset.calendar||state.settings.reportCalendar||state.settings.transactionCalendar||'شمسی');}
          document.getElementById('reportView').value='all';renderReport();
          const reportDataNow=reportData(),chartValue=document.querySelector('.report-bucket .report-bar-col.sales-net .report-bar-value')?.textContent.trim();
          const toAscii=value=>String(value??'').replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[٬٫]/g,m=>m==='٫'?'.':'').replace(/,/g,'').replace(/[^0-9.]/g,'');
          const weeklyHasNetAmount=weeklyValues.some(value=>Math.abs(Number(toAscii(value))-70)<1e-9);
          const tableAmount=document.querySelector('#reportResult tr[data-record-id="qa-return-source"] td:nth-child(7)')?.textContent.trim();
          return {day,expectedDashboard:TameshkCurrency.amount(70,c),dashboardIncome,dashboardProfit,weeklyValues,weeklyHasNetAmount,reportRevenue:reportDataNow.revenue,expectedReport:70,chartValue,expectedChart:TameshkCurrency.format(70,reportDataNow.currencyRecord),sourceTotal:totalTx(sale),sourceUnchanged:JSON.stringify(sale)===before,tableAmount,expectedTableAmount:TameshkCurrency.amount(100,c)};
        }""")
        if (return_check.get("dashboardIncome") == return_check.get("expectedDashboard") and
            return_check.get("dashboardProfit") == return_check.get("expectedDashboard") and
            return_check.get("weeklyHasNetAmount") and
            return_check.get("reportRevenue") == 70 and
            return_check.get("chartValue") == return_check.get("expectedChart") and
            return_check.get("sourceTotal") == 100 and return_check.get("sourceUnchanged") and
            return_check.get("tableAmount") == return_check.get("expectedTableAmount")):
            print("PASS R1: dashboards/reports use net sales after returns; original transaction history remains gross and unchanged")
        else:
            failures.append(f"R1: sales return aggregation mismatch: {return_check}")
        if return_errors:
            failures.append("Return aggregation browser errors: " + " | ".join(return_errors))
        return_page.close()

        # R2: refund principal uses only the item's own gross less its line discount.
        # Transaction discount/tax and ancillary cost/tax are ignored. Quantity edits
        # always recalculate the amount, even after the quantity was cleared.
        refund_page = browser.new_page(viewport={"width": 1180, "height": 900})
        refund_errors: list[str] = []
        refund_page.on("pageerror", lambda error: refund_errors.append(str(error)))
        refund_page.set_content(browser_html(), wait_until="load", timeout=60_000)
        refund_page.wait_for_timeout(500)
        refund_result = refund_page.evaluate("""()=>{
          closeModal();document.getElementById('profileOverlay')?.remove();
          const c=TameshkCurrency.config(),day=new Date().toISOString().slice(0,10);
          const sale={id:'qa-refund-calculation',no:'QA-REFUND-CALC',date:day,dateCalendar:'میلادی',createdAt:new Date().toISOString(),
            currency:c.currency,currencyDecimals:c.currencyDecimals,discount:190,taxOn:true,taxPercent:12,
            ancillaryCost:120,ancillaryTaxOn:true,ancillaryTaxPercent:8,ancillaryTaxAmount:9.6,
            items:[{name:'QA blue pen',productId:null,qty:10,baseQty:10,price:18000,priceAtSale:18000,lineDiscount:180},
                   {name:'QA A4 paper',productId:null,qty:1,baseQty:1,price:2610,priceAtSale:2610,lineDiscount:0}],
            exactTotals:{subtotal:182610,lineDiscount:180,discount:190,taxable:182420,tax:21890.4,ancillaryCost:120,ancillaryTax:9.6,total:204440}};
          state.transactions=[sale];state.transactionReturns=[];state.expenses=[];state.products=[];
          state.inventoryLedger={events:[]};
          const sourceBefore=JSON.stringify(sale);
          tameshkReturnInvoiceLine(sale.id,0);
          const amount=document.getElementById('rmAmount'),qty=document.getElementById('rmQty');
          const initial={amount:amount?.value,max:amount?.max};
          qty.value='';qty.dispatchEvent(new Event('input',{bubbles:true}));const blankAmount=amount.value;
          qty.value='1';qty.dispatchEvent(new Event('input',{bubbles:true}));const oneAmount=amount.value;
          amount.value='17000';const manualAmount=amount.value;
          qty.value='2';qty.dispatchEvent(new Event('input',{bubbles:true}));const twoAmount=amount.value;
          qty.value='';qty.dispatchEvent(new Event('input',{bubbles:true}));const clearedAgain=amount.value;
          qty.value='1';qty.dispatchEvent(new Event('input',{bubbles:true}));const recalculatedOne=amount.value;
          document.getElementById('rmNote').value='QA line-only refund';
          const ok=tameshkSubmitTransactionReturn(sale.id,0),record=state.transactionReturns.find(r=>r.transactionId===sale.id);
          return {initial,blankAmount,oneAmount,manualAmount,twoAmount,clearedAgain,recalculatedOne,ok,
            refundAmount:record?.refundAmount,quantity:record?.quantity,sourceUnchanged:JSON.stringify(sale)===sourceBefore,
            remainingDue:TameshkReturnsManagement.lineDue(sale,0)};
        }""")
        if (not (refund_result.get("initial", {}).get("amount") == "179820" and
                 refund_result.get("blankAmount") == "0" and
                 refund_result.get("oneAmount") == "17982" and
                 refund_result.get("manualAmount") == "17000" and
                 refund_result.get("twoAmount") == "35964" and
                 refund_result.get("clearedAgain") == "0" and
                 refund_result.get("recalculatedOne") == "17982" and
                 refund_result.get("ok") and refund_result.get("refundAmount") == 17982 and
                 refund_result.get("quantity") == 1 and refund_result.get("sourceUnchanged") and
                 abs(refund_result.get("remainingDue", 0) - 161838) < 1e-8)):
            failures.append(f"R2: item-only refund calculation/quantity recalculation mismatch: {refund_result}")
        elif not refund_errors:
            print("PASS R2: refund is price less line discount only; taxes and ancillary charges excluded; quantity edits recalculate")
        if refund_errors:
            failures.append("Refund calculation browser errors: " + " | ".join(refund_errors))
        refund_page.close()

        # T2: return timestamps are editable, localized in the history, and used
        # to order the inventory's latest-event table rather than a noon default.
        time_page = browser.new_page(viewport={"width": 1280, "height": 1000})
        time_errors: list[str] = []
        time_page.on("pageerror", lambda error: time_errors.append(str(error)))
        time_page.set_content(browser_html(), wait_until="load", timeout=60_000)
        time_page.wait_for_timeout(500)
        time_page.evaluate("""()=>{
          closeModal();document.getElementById('profileOverlay')?.remove();
          const c=TameshkCurrency.config(),today=localDate=(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})(),old=new Date();old.setDate(old.getDate()-1);
          const oldAt=old.toISOString();
          state.products=[{id:'qa-time-product',name:'QA return product',category:'QA',unit:'piece',baseUnit:'piece',stock:2,cost:5,avgCost:5,inventoryValue:10,history:[],lots:[]}];
          state.transactions=[{id:'qa-time-sale',no:'QA-TIME',date:today,dateCalendar:'میلادی',createdAt:new Date().toISOString(),customer:'QA',currency:c.currency,currencyDecimals:c.currencyDecimals,discount:0,taxOn:false,taxPercent:0,items:[{name:'QA return product',productId:'qa-time-product',qty:2,baseQty:2,unit:'piece',baseUnit:'piece',price:50,priceAtSale:50,costAtSale:5,cogs:10,lineDiscount:0}],exactTotals:{subtotal:100,lineDiscount:0,discount:0,taxable:100,tax:0,total:100}}];
          state.transactionReturns=[];state.expenseReturns=[];state.expenses=[];
          state.inventoryLedger={version:1,events:[{id:'qa-older-return',type:'sale_return',productId:'qa-time-product',quantity:1,unitCost:5,totalCost:5,sourceId:'old-tx',lineIndex:0,occurredAt:oldAt,createdAt:oldAt,note:'OLDER_RETURN',restocked:false}]};
          window.__qaSaleBefore=JSON.stringify(state.transactions[0]);
        }""")
        time_labels = {"fa": "زمان ثبت مرجوعی", "en": "Return time", "ar": "وقت الإرجاع"}
        for language, expected_label in time_labels.items():
            time_page.evaluate("""language=>{closeModal();setUiLanguage(language);tameshkReturnInvoiceLine('qa-time-sale',0)}""", language)
            time_page.wait_for_function("""()=>!!document.querySelector('#modalInner #rmTime__clock')&&!!document.querySelector('#modalInner #rmTime__clock')?.parentElement?.querySelector('.calendar-time-spinner')""", timeout=8_000)
            values = time_page.evaluate("""()=>({
              label:document.querySelector('#modalInner label[for="rmTime__clock"]')?.textContent.trim()||'',
              nativeTime:document.getElementById('rmTime')?.value||'',
              clock:document.getElementById('rmTime__clock')?.value||'',
              spinnerUnits:[...document.querySelectorAll('#modalInner #rmTime__clock')][0]?.parentElement?.querySelectorAll('.time-spin-value').length||0,
              timeDelta:(()=>{const v=(document.getElementById('rmTime')?.value||'').split(':').map(Number);if(v.length!==3||v.some(Number.isNaN))return Infinity;const input=v[0]*3600+v[1]*60+v[2],d=new Date(),now=d.getHours()*3600+d.getMinutes()*60+d.getSeconds(),diff=Math.abs(input-now);return Math.min(diff,86400-diff)})()
            })""")
            if not values["label"].startswith(expected_label) or not re.fullmatch(r"\d{2}:\d{2}:\d{2}", values["nativeTime"]) or values["spinnerUnits"] != 3 or values["timeDelta"] > 4:
                failures.append(f"T2 {language}: return time input/default-current-time/translation mismatch: {values}")
            if language == "en":
                submitted = time_page.evaluate("""()=>{
                  const fields=[...document.querySelectorAll('#modalInner #rmTime__clock')][0]?.parentElement?.querySelectorAll('.time-spin-value')||[];
                  ['09','12','34'].forEach((value,i)=>{const field=fields[i];if(!field)throw new Error('Missing visible time spinner segment '+i);field.focus();field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));});
                  const native=document.getElementById('rmTime');document.getElementById('rmQty').value='1';tameshkUpdateTransactionRefund('qa-time-sale',0);document.getElementById('rmAmount').value='50';document.getElementById('rmNote').value='QA selected-time return';document.getElementById('rmRestock').checked=false;
                  const date=document.getElementById('rmDate').value;
                  const ok=tameshkSubmitTransactionReturn('qa-time-sale',0),record=state.transactionReturns.find(r=>r.transactionId==='qa-time-sale');
                  const local=record?new Date(record.occurredAt):new Date(NaN),pad=x=>String(x).padStart(2,'0');
                  const event=state.inventoryLedger.events.find(e=>e.type==='sale_return'&&e.returnRecordId===record?.id);
                  return {ok,date,nativeTime:native.value,returnTime:record?.returnTime,localClock:Number.isFinite(+local)?`${pad(local.getHours())}:${pad(local.getMinutes())}:${pad(local.getSeconds())}`:'',occurredAt:record?.occurredAt,eventAt:event?.occurredAt,sourceUnchanged:JSON.stringify(state.transactions[0])===window.__qaSaleBefore,sourceTotal:totalTx(state.transactions[0])};
                }""")
                if not (submitted.get("ok") and submitted.get("returnTime") == "09:12:34" and submitted.get("localClock") == "09:12:34" and submitted.get("occurredAt") == submitted.get("eventAt") and submitted.get("sourceUnchanged") and submitted.get("sourceTotal") == 100):
                    failures.append(f"T2: selected return time was not persisted or the source sale changed: {submitted}")
            else:
                time_page.evaluate("closeModal()")
        event_order = time_page.evaluate("""()=>{
          go('inventory');
          const rows=[...(document.querySelector('table[data-tp-key="inventory-ledger-events"] tbody')?.rows||[])];
          return rows.map(r=>({time:r.cells[0]?.textContent.trim(),note:r.cells[6]?.textContent.trim()}));
        }""")
        if not event_order or event_order[0].get("note") != "QA selected-time return" or len(event_order) < 2 or event_order[1].get("note") != "OLDER_RETURN":
            failures.append(f"T2: inventory latest-event ordering did not follow occurredAt: {event_order[:4]}")
        else:
            print("PASS T2: editable return date/time is localized; selected time is saved and inventory events sort by it")
        localized_history = []
        for language in ["fa", "ar", "en"]:
            time_page.evaluate("""language=>{closeModal();setUiLanguage(language);go('transactions')}""", language)
            time_page.wait_for_timeout(80)
            label = time_page.evaluate("""()=>{
              const value=document.querySelector('.rm-transactions [data-tp-key="sales-returns-history"] tbody tr td:nth-child(2)')?.textContent||'';
              return value.replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)).replace(/[^0-9]/g,'');
            }""")
            localized_history.append((language,label))
        if any(label != "091234" for _, label in localized_history):
            failures.append(f"T2: return history time did not retain/localize HH:mm:ss across languages: {localized_history}")

        # Also exercise the inventory ledger's own return-entry path (different
        # from the canonical sales-return history modal) in every language.
        legacy_labels = {"fa": "زمان ثبت مرجوعی", "en": "Return time", "ar": "وقت الإرجاع"}
        legacy_form_results = []
        for language, expected_label in legacy_labels.items():
            time_page.evaluate("""language=>{closeModal();setUiLanguage(language);go('transactions');inventoryLedgerOpenReturn('qa-time-sale',0)}""", language)
            time_page.wait_for_function("""()=>!!document.querySelector('#modalInner #ledgerReturnTime__clock')&&!!document.querySelector('#modalInner #ledgerReturnTime__clock')?.parentElement?.querySelector('.calendar-time-spinner')""", timeout=8_000)
            values = time_page.evaluate("""()=>({
              label:document.querySelector('#modalInner label[for="ledgerReturnTime__clock"]')?.textContent.trim()||'',
              nativeTime:document.getElementById('ledgerReturnTime')?.value||'',
              spinnerUnits:document.querySelector('#modalInner #ledgerReturnTime__clock')?.parentElement?.querySelectorAll('.time-spin-value').length||0,
              timeDelta:(()=>{const v=(document.getElementById('ledgerReturnTime')?.value||'').split(':').map(Number);if(v.length!==3||v.some(Number.isNaN))return Infinity;const input=v[0]*3600+v[1]*60+v[2],d=new Date(),now=d.getHours()*3600+d.getMinutes()*60+d.getSeconds(),diff=Math.abs(input-now);return Math.min(diff,86400-diff)})()
            })""")
            legacy_form_results.append((language, values))
            if not values['label'].startswith(expected_label) or not re.fullmatch(r"\d{2}:\d{2}:\d{2}", values['nativeTime']) or values['spinnerUnits'] != 3 or values['timeDelta'] > 4:
                failures.append(f"T2 inventory modal {language}: return time field/default/localization mismatch: {values}")
            time_page.evaluate("closeModal()")
        if len(legacy_form_results) == 3 and all(v['spinnerUnits'] == 3 and v['timeDelta'] <= 4 for _, v in legacy_form_results):
            print("PASS T2 inventory modal: localized editable HH:mm:ss time spinner defaults to current time in fa/ar/en")
        if time_errors:
            failures.append("Return time browser errors: " + " | ".join(time_errors))
        time_page.close()

        # L1 + W1: invoice per-item tax strings, amount/rate and control rows are
        # centered and direction-aware in fa/ar/en in both the main app and real
        # detached invoice-widget route. The widget route is mounted by the real
        # desktop-widget module; only URL routing is overridden for this isolated
        # about:blank browser, because local navigation is blocked in this runner.
        tax_record_js = """()=>{const c=TameshkCurrency.config(),day=new Date().toISOString().slice(0,10);state.products=[];state.transactions=[{id:'qa-tax-locale',no:'QA-TAX',date:day,dateCalendar:'میلادی',createdAt:new Date().toISOString(),customer:'QA',currency:c.currency,currencyDecimals:c.currencyDecimals,discount:0,taxOn:true,taxPercent:10,taxMode:'per-item',items:[{name:'Taxed service',unit:'item',qty:1,price:100,priceAtSale:100,lineDiscount:0,taxOn:true,taxPercent:10,taxAmount:10},{name:'Untaxed service',unit:'item',qty:1,price:100,priceAtSale:100,lineDiscount:0,taxOn:false,taxPercent:0,taxAmount:0}],exactTotals:{subtotal:200,lineDiscount:0,discount:0,taxable:200,tax:10,total:210}}]}"""
        expected_no_tax = {"fa": "بدون مالیات برای این قلم", "en": "No tax for this item", "ar": "لا توجد ضريبة لهذا البند"}
        expected_tax = {"fa": "مالیات این قلم", "en": "Item tax", "ar": "ضريبة البند"}
        expected_direction = {"fa": "rtl", "ar": "rtl", "en": "ltr"}

        def inspect_tax(page_obj):
            return page_obj.evaluate("""()=>{
              const noRow=document.querySelector('#modalInner .invoice-tax-details[data-index="1"]'),taxRow=document.querySelector('#modalInner .invoice-tax-details[data-index="0"]');
              function inspect(row){if(!row)return null;const cell=row.querySelector('td'),content=row.querySelector('.invoice-tax-details-content'),children=[...(content?.children||[])],rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,right:r.right,width:r.width}},cellRect=rect(cell),items=children.map(rect);const left=Math.min(...items.map(x=>x.x)),right=Math.max(...items.map(x=>x.right));return{text:content?.textContent||'',dir:content?.getAttribute('dir'),computedDir:content?getComputedStyle(content).direction:'',cellAlign:cell?getComputedStyle(cell).textAlign:'',display:content?getComputedStyle(content).display:'',justify:content?getComputedStyle(content).justifyContent:'',childCount:children.length,centerDelta:Math.abs((left+right)/2-(cellRect.x+cellRect.right)/2),taxToggle:!!content?.querySelector('.invoice-item-tax-on'),rateInput:!!content?.querySelector('.invoice-item-tax-rate')}}
              return {noTax:inspect(noRow),tax:inspect(taxRow),widget:!!window.__tameshkWidgetRoute,bodyWidget:document.body.classList.contains('widget-panel-body'),direction:document.documentElement.dir};
            }""")

        tax_main = browser.new_page(viewport={"width": 1360, "height": 1000})
        tax_main_errors: list[str] = []
        tax_main.on("pageerror", lambda error: tax_main_errors.append(str(error)))
        tax_main.set_content(browser_html(), wait_until="load", timeout=60_000)
        tax_main.wait_for_timeout(500)
        tax_main_results = []
        for language in ["fa", "ar", "en"]:
            tax_main.evaluate(tax_record_js, None)
            tax_main.evaluate("language=>{setUiLanguage(language);showInvoice('qa-tax-locale',false);applyUiLanguage()}" , language)
            static = inspect_tax(tax_main)
            no_text_ok = expected_no_tax[language] in (static["noTax"] or {}).get("text", "")
            tax_text_ok = expected_tax[language] in (static["tax"] or {}).get("text", "")
            direction_ok = static.get("direction") == expected_direction[language] and static["noTax"].get("dir") == expected_direction[language] and static["noTax"].get("computedDir") == expected_direction[language]
            centered_ok = all(item and item["cellAlign"] == "center" and item["display"] == "flex" and item["justify"] == "center" and item["centerDelta"] < 4 for item in [static["noTax"], static["tax"]])
            percent_mark = "%" if language == "en" else "٪"
            if not (no_text_ok and tax_text_ok and direction_ok and centered_ok and percent_mark in static["tax"]["text"]):
                failures.append(f"L1 main static tax locale/alignment {language}: {static}")
            tax_main.evaluate("language=>{showInvoice('qa-tax-locale',true);applyUiLanguage()}" , language)
            editable = inspect_tax(tax_main)
            if not all(item and item["cellAlign"] == "center" and item["justify"] == "center" and item["taxToggle"] and item["rateInput"] for item in [editable["noTax"], editable["tax"]]):
                failures.append(f"L1 main editable tax row alignment/control {language}: {editable}")
            tax_main_results.append((language, centered_ok and direction_ok and no_text_ok and tax_text_ok))
        if tax_main_errors:
            failures.append("Main invoice locale browser errors: " + " | ".join(tax_main_errors))
        if all(ok for _, ok in tax_main_results):
            print("PASS L1: per-item tax labels, amounts/rates, direction and centering in fa/ar/en (main invoice; static and editable)")
        tax_main.close()

        tax_widget = browser.new_page(viewport={"width": 480, "height": 900})
        tax_widget_errors: list[str] = []
        tax_widget.on("pageerror", lambda error: tax_widget_errors.append(str(error)))
        tax_widget.set_content(browser_html(widget_route="invoice", widget_record="qa-tax-locale"), wait_until="load", timeout=60_000)
        tax_widget.wait_for_function("""()=>window.__tameshkWidgetRoute==='invoice'&&document.body.classList.contains('widget-panel-body')""", timeout=8_000)
        tax_widget.wait_for_timeout(150)
        tax_widget_results = []
        for language in ["fa", "ar", "en"]:
            tax_widget.evaluate(tax_record_js, None)
            tax_widget.evaluate("language=>{setUiLanguage(language);render();applyUiLanguage()}" , language)
            tax_widget.wait_for_selector('#modalInner .invoice-tax-details-content', timeout=8_000)
            static = inspect_tax(tax_widget)
            no_text_ok = expected_no_tax[language] in (static["noTax"] or {}).get("text", "")
            tax_text_ok = expected_tax[language] in (static["tax"] or {}).get("text", "")
            direction_ok = static.get("direction") == expected_direction[language] and static["noTax"].get("computedDir") == expected_direction[language]
            centered_ok = all(item and item["cellAlign"] == "center" and item["display"] == "flex" and item["justify"] == "center" and item["centerDelta"] < 4 for item in [static["noTax"], static["tax"]])
            if not (no_text_ok and tax_text_ok and direction_ok and centered_ok):
                failures.append(f"W1 widget static tax locale/alignment {language}: {static}")
            tax_widget.evaluate("language=>{showInvoice('qa-tax-locale',true);applyUiLanguage()}" , language)
            editable = inspect_tax(tax_widget)
            if not all(item and item["cellAlign"] == "center" and item["justify"] == "center" and item["taxToggle"] and item["rateInput"] for item in [editable["noTax"], editable["tax"]]):
                failures.append(f"W1 widget editable tax row alignment/control {language}: {editable}")
            tax_widget_results.append((language, centered_ok and direction_ok and no_text_ok and tax_text_ok))
        if tax_widget_errors:
            failures.append("Widget invoice locale browser errors: " + " | ".join(tax_widget_errors))
        if all(ok for _, ok in tax_widget_results):
            print("PASS W1: real detached invoice-widget tax rows use the same centered, translated RTL/LTR layout at 480px")
        tax_widget.close()

        # R3: changing either custom report date re-renders every report surface.
        # Cash-wallet opening is the balance immediately before the range start;
        # receipts and payments are totaled only within the selected date interval.
        range_page = browser.new_page(viewport={"width": 1360, "height": 1050})
        range_errors: list[str] = []
        range_page.on("pageerror", lambda error: range_errors.append(str(error)))
        range_page.set_content(browser_html(), wait_until="load", timeout=60_000)
        range_page.wait_for_timeout(600)
        range_page.evaluate("""()=>{
          closeModal();document.getElementById('profileOverlay')?.remove();setUiLanguage('fa');
          const c=TameshkCurrency.config(),isoToday=(()=>{const d=new Date(),p=x=>String(x).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`})();
          state.settings.walletOpeningBalance=1000;state.settings.walletOpeningCurrencyRecord={currency:c.currency,currencyDecimals:c.currencyDecimals};
          const sale=(id,date,total,paymentMethod='نقدی')=>({id,no:id,date,dateCalendar:'میلادی',createdAt:`${date}T12:00:00.000Z`,customer:id,paymentMethod,currency:c.currency,currencyDecimals:c.currencyDecimals,discount:0,taxOn:false,taxPercent:0,items:[{name:'QA wallet sale',qty:1,price:total,priceAtSale:total}],exactTotals:{subtotal:total,lineDiscount:0,discount:0,taxable:total,tax:0,total}});
          state.transactions=[sale('cash-before','2026-10-09',300),sale('cash-10','2026-10-10',100),sale('cash-11','2026-10-11',200),sale('cash-after','2026-10-13',999),sale('cash-today',isoToday,700)];
          state.expenses=[
            {id:'wallet-exp-before',itemNumber:'E-000001',title:'Before',date:'2026-10-08',dateCalendar:'میلادی',amount:100,paymentMethod:'نقدی',currency:c.currency,currencyDecimals:c.currencyDecimals},
            {id:'wallet-exp-range',itemNumber:'E-000002',title:'Range cash expense',date:'2026-10-11',dateCalendar:'میلادی',amount:20,paymentMethod:'نقدی',currency:c.currency,currencyDecimals:c.currencyDecimals},
            {id:'wallet-exp-card',itemNumber:'E-000003',title:'Range card expense',date:'2026-10-11',dateCalendar:'میلادی',amount:99,paymentMethod:'کارت',currency:c.currency,currencyDecimals:c.currencyDecimals},
            {id:'wallet-exp-after',itemNumber:'E-000004',title:'After',date:'2026-10-13',dateCalendar:'میلادی',amount:500,paymentMethod:'نقدی',currency:c.currency,currencyDecimals:c.currencyDecimals}
          ];
          state.transactionReturns=[
            {id:'wallet-return-range',transactionId:'cash-11',lineIndex:0,quantity:.05,refundAmount:10,returnDate:'2026-10-12',refundToCash:true,currency:c.currency,currencyDecimals:c.currencyDecimals},
            {id:'wallet-return-after',transactionId:'cash-after',lineIndex:0,quantity:.05,refundAmount:50,returnDate:'2026-10-13',refundToCash:true,currency:c.currency,currencyDecimals:c.currencyDecimals}
          ];
          state.expenseReturns=[];state.creditRecords=[];state.installments=[];
          go('reports');
        }""")
        def set_report_date(field_id: str, iso: str) -> None:
            range_page.evaluate("""({fieldId,iso})=>{
              const el=document.getElementById(fieldId);el.value=TameshkCalendar.format(iso,el.dataset.calendar||'شمسی');
              el.dispatchEvent(new Event('change',{bubbles:true}));
            }""", {"fieldId": field_id, "iso": iso})
        set_report_date("reportFrom", "2026-10-10")
        set_report_date("reportTo", "2026-10-12")
        range_page.wait_for_timeout(80)
        manual_range = range_page.evaluate("""()=>{
          const data=reportData(),wallet=TameshkReportWalletNumbering.walletFigures(data.currencyRecord),field=id=>TameshkCalendar.read(document.getElementById(id));
          const host=document.getElementById('reportWalletSummary'),controls=host?.previousElementSibling;
          return {
            from:field('reportFrom'),to:field('reportTo'),revenue:data.revenue,expenses:data.expenses,
            txIds:data.tx.map(x=>x.id).sort(),tableIds:[...document.querySelectorAll('#reportResult [data-tp-key="report-sales"] tbody tr[data-record-id]')].map(x=>x.dataset.recordId).sort(),
            expenseRowCount:document.querySelectorAll('#reportResult [data-tp-key="report-expenses"] tbody tr:not([data-tp-empty])').length,
            chartCount:document.querySelectorAll('#reportResult .report-bucket').length,
            chart:[...document.querySelectorAll('#reportResult .report-bucket')].map(bucket=>({label:bucket.querySelector('.report-bucket-label')?.textContent||'',sales:bucket.querySelector('.sales-net .report-bar')?.getAttribute('aria-label')||'',expenses:bucket.querySelector('.report-bar.expense')?.getAttribute('aria-label')||''})),
            expectedChart:[['2026-10-10',100],['2026-10-11',200],['2026-10-12',-10]].map(([date,amount])=>({label:TameshkCalendar.format(date,window.TameshkEnhancements146?.activeReportCal?.()||state.settings.reportCalendar||state.settings.transactionCalendar||'شمسی'),sales:`${uiText('فروش خالص')}: ${TameshkCurrency.format(amount,data.currencyRecord)} ${TameshkCurrency.symbol(data.currencyRecord)}`})),
            summary:document.querySelector('#reportResult .selected-period-summary')?.textContent||'',
            salesKpi:document.querySelector('#reportResult .report-kpis .stat .value')?.textContent||'',
            wallet:{opening:wallet.opening,income:wallet.income,expenses:wallet.expenses,balance:wallet.balance},
            walletDom:{opening:document.getElementById('walletOpeningBalance')?.value||'',income:host?.querySelector('[data-wallet-income]')?.textContent||'',expenses:host?.querySelector('[data-wallet-expenses]')?.textContent||'',balance:host?.querySelector('[data-wallet-balance]')?.textContent||''},
            expectedWalletDom:{income:TameshkCurrency.amount(wallet.income,wallet.currencyRecord),expenses:TameshkCurrency.amount(wallet.expenses,wallet.currencyRecord),balance:TameshkCurrency.amount(wallet.balance,wallet.currencyRecord)},
            walletAfterRangeControls:!!controls?.querySelector('#reportFrom')&&!!controls?.querySelector('#reportTo')
          };
        }""")
        if not (manual_range.get("from") == "2026-10-10" and manual_range.get("to") == "2026-10-12" and
                abs(manual_range.get("revenue", 0) - 290) < 1e-8 and abs(manual_range.get("expenses", 0) - 119) < 1e-8 and
                manual_range.get("txIds") == ["cash-10", "cash-11"] and manual_range.get("tableIds") == ["cash-10", "cash-11"] and
                manual_range.get("expenseRowCount") == 2 and manual_range.get("chartCount") == 3 and manual_range.get("summary") and
                all(item["label"] == expected["label"] and expected["sales"] in item["sales"] for item, expected in zip(manual_range.get("chart", []), manual_range.get("expectedChart", []))) and
                manual_range.get("salesKpi") and
                manual_range.get("wallet") == {"opening":1200,"income":300,"expenses":30,"balance":1470} and
                manual_range.get("walletDom", {}).get("opening") == "1200" and
                manual_range.get("walletDom", {}).get("income") == manual_range.get("expectedWalletDom", {}).get("income") and
                manual_range.get("walletDom", {}).get("expenses") == manual_range.get("expectedWalletDom", {}).get("expenses") and
                manual_range.get("walletDom", {}).get("balance") == manual_range.get("expectedWalletDom", {}).get("balance") and
                manual_range.get("walletAfterRangeControls")):
            failures.append(f"R3 manual dates did not refresh report surfaces and period wallet: {manual_range}")
        elif not range_errors:
            print("PASS R3 manual dates: statistics, summary, chart values/dates, sales/expenses rows, and period wallet refresh")

        view_mode_results = []
        for view_kind in ["stats", "text", "table", "graphic", "all"]:
            view_result = range_page.evaluate("""kind=>{
              const select=document.getElementById('reportView');select.value=kind;renderReport();
              const data=reportData(),box=document.getElementById('reportResult');
              return {kind,revenue:data.revenue,expenses:data.expenses,kpis:!!box.querySelector('.report-kpis'),summary:!!box.querySelector('.selected-period-summary'),chart:!!box.querySelector('.report-chart-panel'),sales:!!box.querySelector('[data-tp-key="report-sales"]'),expenseTable:!!box.querySelector('[data-tp-key="report-expenses"]'),wallet:!!document.getElementById('reportWalletSummary'),walletOpening:Number(document.getElementById('walletOpeningBalance')?.value)};
            }""", view_kind)
            expected_parts = {
                "stats": (True,False,False,False),
                "text": (False,True,False,False),
                "table": (False,False,False,True),
                "graphic": (False,False,True,False),
                "all": (True,True,True,True),
            }[view_kind]
            actual_parts = (view_result["kpis"],view_result["summary"],view_result["chart"],view_result["sales"] and view_result["expenseTable"])
            if not (abs(view_result["revenue"]-290)<1e-8 and abs(view_result["expenses"]-119)<1e-8 and actual_parts==expected_parts and view_result["wallet"] and view_result["walletOpening"]==1200):
                failures.append(f"R3 report mode {view_kind} did not preserve range-scoped report/wallet results: {view_result}")
            view_mode_results.append(view_result)
        if len(view_mode_results)==5 and all(abs(item["revenue"]-290)<1e-8 and abs(item["expenses"]-119)<1e-8 for item in view_mode_results) and not range_errors:
            print("PASS R3 report modes: stats/text/table/graphic/all preserve the selected interval and period wallet")

        shortcut_results = []
        range_names = {"day":"امروز", "week":"هفته", "month":"ماه", "year":"سال"}
        for kind, button_name in range_names.items():
            range_page.get_by_role("button", name=button_name, exact=True).click()
            range_page.wait_for_timeout(40)
            value = range_page.evaluate("""kind=>{
              const end=new Date(),start=new Date(end),pad=x=>String(x).padStart(2,'0'),iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
              const report={from:TameshkCalendar.read(document.getElementById('reportFrom')),to:TameshkCalendar.read(document.getElementById('reportTo'))};
              const selected=reportData(),wallet=TameshkReportWalletNumbering.walletFigures(selected.currencyRecord);
              if(kind==='week')start.setDate(end.getDate()-6);
              else if(kind==='month')start.setDate(1);
              else if(kind==='year')start.setMonth(0,1);
              const ids=[...document.querySelectorAll('#reportResult [data-tp-key="report-sales"] tbody tr[data-record-id]')].map(x=>x.dataset.recordId).sort();
              return {report,expectedFrom:iso(start),expectedTo:iso(end),txCount:selected.tx.length,tableCount:ids.length,
                hasSummary:!!document.querySelector('#reportResult .selected-period-summary'),chartCount:document.querySelectorAll('#reportResult .report-bucket').length,
                walletOpening:wallet.opening,walletIncome:wallet.income,walletExpenses:wallet.expenses,walletBalance:wallet.balance,
                walletDomOpening:Number(document.getElementById('walletOpeningBalance')?.value),walletDomIncome:document.querySelector('#reportWalletSummary [data-wallet-income]')?.textContent||'',
                walletDomExpenses:document.querySelector('#reportWalletSummary [data-wallet-expenses]')?.textContent||'',
                expectedWalletIncomeAmount:TameshkCurrency.amount(wallet.income,wallet.currencyRecord),
                expectedWalletExpensesAmount:TameshkCurrency.amount(wallet.expenses,wallet.currencyRecord),
                kpi:document.querySelector('#reportResult .report-kpis .stat .value')?.textContent||''};
            }""", kind)
            start_check = {"from": value["expectedFrom"], "to": value["expectedTo"]}
            if not (value["report"] == start_check and value["report"]["to"] == value["expectedTo"] and
                    value["txCount"] == value["tableCount"] and value["hasSummary"] and value["chartCount"] > 0 and
                    value["walletOpening"] == value["walletDomOpening"] and
                    value["walletDomIncome"] == value["expectedWalletIncomeAmount"] and
                    value["walletDomExpenses"] == value["expectedWalletExpensesAmount"] and
                    value["kpi"]):
                failures.append(f"R3 shortcut {kind} ({button_name}) did not refresh all outputs: {value}")
            shortcut_results.append((kind, value))
        if len(shortcut_results) == 4 and all(v.get("txCount") == v.get("tableCount") for _, v in shortcut_results) and not range_errors:
            print("PASS R3 shortcuts: today/week/month/year refresh every report view and wallet, with local-calendar dates")
        if range_errors:
            failures.append("Report range browser errors: " + " | ".join(range_errors))
        page_errors.extend(range_errors)
        range_page.close()

        # I4: edit typography in a custom template, persist, navigate away/back,
        # then render a final invoice using that template.
        page.evaluate("currentPage='settings';render();duplicateInvoiceTemplate()")
        field_id = page.evaluate("state.settings.invoiceTemplates[0].fields.find(f=>f.source==='business.name').id")
        page.evaluate("id=>window.updateInvoiceFieldStyle(id,'fontSize','17')", field_id)
        persisted = page.evaluate("""id=>{
          const template=state.settings.invoiceTemplates.find(t=>t.id===document.getElementById('tmSelect').value);
          const raw=JSON.parse(localStorage.getItem('tameshk-state'));
          const saved=raw.settings.invoiceTemplates.find(t=>t.id===template.id);
          return {live:template.fields.find(f=>f.id===id)?.fontSize,stored:saved.fields.find(f=>f.id===id)?.fontSize,id:template.id};
        }""", field_id)
        page.evaluate("currentPage='dashboard';render();currentPage='settings';render()")
        after_navigation = page.evaluate("id=>state.settings.invoiceTemplates.find(t=>t.id===document.getElementById('tmSelect').value)?.fields.find(f=>f.id===id)?.fontSize", field_id)
        page.evaluate("id=>{const c=window.TameshkCurrency.config();state.transactions.push({id:'qa-i4',no:'QA-I4',date:new Date().toISOString().slice(0,10),customer:'QA customer',currency:c.currency,currencyDecimals:c.currencyDecimals,invoiceTemplateId:state.settings.invoiceTemplates.find(t=>t.id===document.getElementById('tmSelect').value).id,items:[{name:'QA service',qty:1,price:100}],discount:0,taxOn:false,taxPercent:0,exactTotals:{subtotal:100,lineDiscount:0,discount:0,taxable:100,tax:0,total:100}});save();showInvoice('qa-i4',false)}", field_id)
        final_style = page.evaluate("""()=>{
          const el=document.querySelector('#modalInner .tm-business-name');
          return el?{style:el.getAttribute('style'),fontSize:getComputedStyle(el).fontSize}:null;
        }""")
        if persisted.get("live") == 17 and persisted.get("stored") == 17 and after_navigation == 17 and final_style and "font-size:17pt" in final_style["style"]:
            print("PASS I4: typography persists and applies to final invoice (17pt)")
        else:
            failures.append(f"I4: persistence/render mismatch: saved={persisted}, after_navigation={after_navigation}, final={final_style}")

        # Reload from the actual serialized local state in a fresh browser page.
        saved_state_json = page.evaluate("localStorage.getItem('tameshk-state')")
        restarted = browser.new_page()
        restart_errors: list[str] = []
        restarted.on("pageerror", lambda error: restart_errors.append(str(error)))
        restarted.set_content(browser_html(saved_state_json), wait_until="load", timeout=60_000)
        restarted.wait_for_timeout(500)
        restart_result = restarted.evaluate("""()=>{
          const t=state.settings.invoiceTemplates.find(t=>t.id===state.settings.invoiceTemplate);
          const f=t?.fields.find(f=>f.source==='business.name');
          showInvoice('qa-i4',false);
          const el=document.querySelector('#modalInner .tm-business-name');
          return {fontSize:f?.fontSize, invoiceTemplateId:state.transactions.find(t=>t.id==='qa-i4')?.invoiceTemplateId, defaultId:state.settings.invoiceTemplate, rendered:el?.getAttribute('style')};
        }""")
        if restart_result.get("fontSize") == 17 and restart_result.get("invoiceTemplateId") == restart_result.get("defaultId") and restart_result.get("rendered") and "font-size:17pt" in restart_result["rendered"]:
            print("PASS I4 restart: saved template reloads and final invoice still uses 17pt")
        else:
            failures.append(f"I4 restart: persisted style did not survive a fresh app context: {restart_result}")
        page_errors.extend(restart_errors)
        restarted.close()

        # Cross-panel table-footer layout: use a fresh real Chromium DOM while
        # keeping navigation on about:blank because this environment blocks all
        # URL navigation through its managed URLBlocklist policy.
        layout_page = browser.new_page(viewport={"width": 1440, "height": 1100})
        layout_errors: list[str] = []
        layout_page.on("pageerror", lambda error: layout_errors.append(str(error)))
        layout_page.set_content(browser_html(), wait_until="load", timeout=60_000)
        layout_page.wait_for_timeout(600)
        layout_page.evaluate("""()=>{
          closeModal(); document.getElementById('profileOverlay')?.remove(); setUiLanguage('en'); go('dashboard');
          TameshkCurrency.setConfig('USD',2); state.settings.featureOptions.expenses=false;
          state.products=Array.from({length:22},(_,i)=>({id:'qa-p-'+i,name:'Product '+i,category:'Test',unit:'unit',stock:30,price:10,cost:5,history:[]}));
          state.transactions=Array.from({length:22},(_,i)=>({id:'qa-tx-'+i,no:'QA-'+i,date:'2026-10-11',dateCalendar:'میلادی',customer:'Customer '+i,currency:'USD',currencyDecimals:2,discount:0,taxOn:false,items:[{name:'QA service',unit:'custom',qty:1,price:10}],exactTotals:{subtotal:10,discount:0,tax:0,total:10}}));
          state.expenses=Array.from({length:22},(_,i)=>({id:'qa-ex-'+i,title:'Expense '+i,date:'2026-10-11',category:'custom',amount:5,currency:'USD',currencyDecimals:2}));
          state.expenseReturns=Array.from({length:22},(_,i)=>({id:'qa-er-'+i,expenseId:'qa-ex-'+i,amount:1,date:'2026-10-11',note:'Refund '+i,currency:'USD',currencyDecimals:2,cash:true}));
          state.transactionReturns=Array.from({length:22},(_,i)=>({id:'qa-tr-'+i,transactionId:'qa-tx-'+i,lineIndex:0,quantity:1,refundAmount:1,returnDate:'2026-10-11',itemName:'QA service',note:'Return '+i,currency:'USD',currencyDecimals:2}));
        }""")
        audited: set[str] = set()
        for route in ["dashboard", "transactions", "expenses", "reports", "inventory", "finance", "settings"]:
            layout_page.evaluate("""route=>{
              closeModal(); go(route);
              if(route==='reports'){
                for(const[id,iso]of[['reportFrom','2026-10-10'],['reportTo','2026-10-12']]){
                  const e=document.getElementById(id);e.dataset.iso=iso;e.dataset.snapshot=e.value=TameshkCalendar.format(iso,e.dataset.calendar);
                }
                document.getElementById('reportView').value='all';renderReport();
              }
            }""", route)
            layout_page.wait_for_function("""()=>[...document.querySelectorAll('#content [data-tp-key][data-tp-size]')].every(host=>{
              const table=host.matches('table')?host:host.querySelector('table');
              if(!table||!table.tBodies[0])return true;
              return [...document.querySelectorAll('[data-tp-controls-for]')].filter(c=>c.dataset.tpControlsFor===host.dataset.tpKey).length===1;
            })""", timeout=5_000)
            controls = layout_page.evaluate("""()=>[...document.querySelectorAll('#content [data-tp-key][data-tp-size]')].map(host=>{
              const table=host.matches('table')?host:host.querySelector('table');if(!table||!table.tBodies[0])return null;
              const anchor=table.closest('.table-wrap')||table,key=host.dataset.tpKey;
              const matches=[...document.querySelectorAll('[data-tp-controls-for]')].filter(c=>c.dataset.tpControlsFor===key),c=matches[0];
              return {key,count:matches.length,adjacent:c===anchor.nextElementSibling,under:!!c&&(c.hidden||c.getBoundingClientRect().top>=anchor.getBoundingClientRect().bottom-2)};
            }).filter(Boolean)""")
            for item in controls:
                audited.add(item["key"])
                if item["count"] != 1 or not item["adjacent"] or not item["under"]:
                    failures.append(f"Table footer layout mismatch on {route}: {item}")
        if "report-sales" not in audited or "report-expenses" not in audited or len(audited) < 8:
            failures.append(f"Table footer coverage incomplete: {sorted(audited)}")
        elif not layout_errors:
            print(f"PASS table layout: {len(audited)} table types across dashboard, transactions, expenses, reports, inventory, and finance")
        else:
            failures.append("Table layout browser errors: " + " | ".join(layout_errors))
        page_errors.extend(layout_errors)
        layout_page.close()

        if page_errors:
            failures.append("Browser page errors: " + " | ".join(page_errors))
        browser.close()

    if failures:
        for failure in failures:
            print("FAIL", failure)
        return 1
    print("Browser regression checks passed: 13/13; page errors: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

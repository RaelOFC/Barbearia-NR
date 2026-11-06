// barbearianr - lógica do site (login, vendas, estoque, fiado, calculadora, equipe e backup)

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dk = d => new Date(d).toLocaleDateString('sv');
const fd = d => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const IDB = { db: null, open() { return new Promise(r => { try {
        const q = indexedDB.open('nr_db', 1);
        q.onupgradeneeded = () => q.result.createObjectStore('kv');
        q.onsuccess = () => { IDB.db = q.result; r(); };
        q.onerror = () => r();
    }
    catch (e) {
        r();
    } }); },
    put(k, v) { try {
        IDB.db && IDB.db.transaction('kv', 'readwrite').objectStore('kv').put(v, k);
    }
    catch (e) { } },
    all() { return new Promise(r => { try {
        const o = {}, q = IDB.db.transaction('kv').objectStore('kv').openCursor();
        q.onsuccess = () => { const c = q.result; if (c) {
            o[c.key] = c.value;
            c.continue();
        }
        else
            r(o); };
        q.onerror = () => r({});
    }
    catch (e) {
        r({});
    } }); } };
const ls = { get(k, d) { for (const key of [k, k + '__bk']) {
        try {
            const v = JSON.parse(localStorage.getItem(key));
            if (v != null) {
                if (key !== k)
                    try {
                        localStorage.setItem(k, JSON.stringify(v));
                    }
                    catch (e) { }
                return v;
            }
        }
        catch (e) { }
    } return d; },
    set(k, v) { try {
        const s = JSON.stringify(v);
        localStorage.setItem(k, s);
        localStorage.setItem(k + '__bk', s);
        IDB.put(k, s);
        return true;
    }
    catch (e) {
        alert('Não foi possível salvar. Verifique o armazenamento do navegador.');
        return false;
    } } };
async function H(p, s) {
    if (!crypto.subtle)
        throw new Error('Abra o site em HTTPS para usar o login seguro.');
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s + p));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const CFG = { business: 'Barbearia NR', lowStock: 3, defaultUser: { id: 'u_dadau', name: 'dadau', user: 'dadau', salt: 'nr-dadau', hash: '0690e62ee428ccdf5d8ecc0214be7aec39c08f90f8c51d05705146768b8e13f8' } };
let users = [];
function seed() { users = ls.get('nr_users', []); if (!Array.isArray(users) || !users.length) {
    const u = CFG.defaultUser;
    users = [{ id: u.id, name: u.name, user: u.user, salt: u.salt, hash: u.hash, access: [u.id] }];
    ls.set('nr_users', users);
} }
let me, pid, D, tab = 'inicio';
const empty = () => ({ sales: [], stock: [], fiado: [], paid: [] });
const save = () => ls.set('nr_d_' + pid, D);
function boot() {
    me = users.find(u => u.id === ls.get('nr_sess', null));
    if (!me) {
        $('#app').classList.add('hide');
        $('#auth').classList.remove('hide');
        return;
    }
    pid = ls.get('nr_panel_' + me.id, me.id);
    if (!me.access.includes(pid))
        pid = me.id;
    D = Object.assign(empty(), ls.get('nr_d_' + pid, {}));
    $('#auth').classList.add('hide');
    $('#app').classList.remove('hide');
    $('#ps').innerHTML = me.access.map(p => `<option value="${p}" ${p === pid ? 'selected' : ''}>${p === me.id ? 'Meu painel' : 'Painel de ' + esc((users.find(u => u.id === p) || {}).name || '?')}</option>`).join('');
    $('#ps').classList.toggle('hide', me.access.length < 2);
    $('#nav').innerHTML = [['inicio', 'Início', '📊'], ['vendas', 'Vendas', '💈'], ['estoque', 'Estoque', '📦'], ['fiado', 'Fiado', '📒'], ['calc', 'Calc', '🧮'], ['equipe', 'Equipe', '👥'], ['backup', 'Backup', '💾']]
        .map(t => `<button class="${t[0] === tab ? 'on' : ''}" onclick="go('${t[0]}')"><span>${t[2]}</span>${t[1]}</button>`).join('');
    render();
}
function go(t) { tab = t; boot(); scrollTo(0, 0); }
function setPanel(p) { ls.set('nr_panel_' + me.id, p); boot(); }
function logout() { ls.set('nr_sess', null); tab = 'inicio'; authTab('L'); boot(); }
function authTab(t) { $('#fL').classList.toggle('hide', t !== 'L'); $('#fR').classList.toggle('hide', t !== 'R'); $('#tL').classList.toggle('on', t === 'L'); $('#tR').classList.toggle('on', t === 'R'); $('#ae').textContent = ''; }
async function doLogin() {
    const u = users.find(x => x.user === $('#lu').value.trim().toLowerCase());
    try {
        const ok = u && await H($('#lp').value, u.salt) === u.hash;
        if (!ok) {
            await new Promise(r => setTimeout(r, 700));
            $('#ae').textContent = 'Usuário ou senha incorretos.';
            return;
        }
        ls.set('nr_sess', u.id);
        $('#lp').value = '';
        $('#ae').textContent = '';
        boot();
    }
    catch (e) {
        $('#ae').textContent = e.message;
    }
}
async function doReg() {
    const n = $('#rn').value.trim(), u = $('#ru').value.trim().toLowerCase(), p = $('#rp').value;
    if (n.length < 2)
        return $('#ae').textContent = 'Informe seu nome.';
    if (!/^[a-z0-9_.]{3,20}$/.test(u))
        return $('#ae').textContent = 'Usuário: 3 a 20 letras, números, _ ou .';
    if (p.length < 8)
        return $('#ae').textContent = 'A senha precisa ter pelo menos 8 caracteres.';
    if (users.some(x => x.user === u))
        return $('#ae').textContent = 'Esse usuário já existe.';
    try {
        const id = 'u_' + uid(), salt = uid() + uid();
        users.push({ id, name: n, user: u, salt, hash: await H(p, salt), access: [id] });
        if (!ls.set('nr_users', users))
            return;
        ls.set('nr_sess', id);
        ['rn', 'ru', 'rp'].forEach(i => $('#' + i).value = '');
        $('#ae').textContent = '';
        boot();
    }
    catch (e) {
        $('#ae').textContent = e.message;
    }
}
function render() {
    const f = { inicio: vInicio, vendas: vVendas, estoque: vEstoque, fiado: vFiado, calc: vCalc, equipe: vEquipe, backup: vBackup }[tab];
    $('#main').innerHTML = f();
}
const rev = () => D.sales.filter(s => s.pay !== 'Fiado');
const sum = a => a.reduce((t, s) => t + s.total, 0);
function vInicio() {
    const td = dk(new Date()), mo = td.slice(0, 7), r = rev();
    const hj = r.filter(s => dk(s.date) === td), mm = r.filter(s => dk(s.date).startsWith(mo));
    const lb = ls.get('nr_lastbk_' + me.id, null), need = pid === me.id && (!lb || Date.now() - new Date(lb) > 7 * 864e5);
    const baixo = D.stock.filter(p => p.qty <= CFG.lowStock);
    return `<h2>Olá, ${esc(me.name)}</h2><p class="sub">Resumo da Barbearia NR</p>
  <div class="grid">
   <div class="stat gold"><small>Hoje</small><b>${R(sum(hj))}</b><span>${hj.length} venda(s)</span></div>
   <div class="stat"><small>Este mês</small><b>${R(sum(mm))}</b><span>${mm.length} venda(s)</span></div>
   <div class="stat"><small>Fiado a receber</small><b style="color:var(--bad)">${R(D.fiado.reduce((t, f) => t + f.value, 0))}</b><span>${D.fiado.length} pendente(s)</span></div>
   <div class="stat"><small>Estoque baixo</small><b>${baixo.length}</b><span>${D.stock.length} produto(s)</span></div>
  </div>
  <div class="card"><b>Últimas vendas</b><div class="list">${D.sales.slice(0, 6).map(s => `<div><div class="t"><b>${esc(s.desc)}</b><small>${fd(s.date)} · ${esc(s.pay)}</small></div><div class="v ${s.pay === 'Fiado' ? 'y' : 'g'}">${R(s.total)}</div></div>`).join('') || '<div class="empty">Nenhuma venda ainda.</div>'}</div></div>
  ${need ? `<div class="card" style="border-color:var(--gold)"><b>💾 Faça um backup</b><p class="sub" style="margin:4px 0 10px">${lb ? 'Seu último backup foi há mais de 7 dias.' : 'Você ainda não fez nenhum backup.'}</p><button class="btn s" onclick="go('backup')">Fazer agora</button></div>` : ''}
  ${baixo.length ? `<div class="card"><b>⚠ Repor estoque</b><div class="list">${baixo.map(p => `<div><div class="t"><b>${esc(p.name)}</b></div><span class="badge low">${p.qty} un.</span></div>`).join('')}</div></div>` : ''}`;
}
function vVendas() {
    return `<h2>Vendas</h2><p class="sub">Registre produtos e serviços</p>
  <div class="card"><label style="margin-top:0">Item / serviço</label><input id="vi" list="dl" placeholder="Ex: Corte, Barba, Cerveja, Pomada" oninput="autoP()">
  <datalist id="dl">${D.stock.map(p => `<option value="${esc(p.name)}">`).join('')}<option value="Corte"><option value="Barba"><option value="Corte + Barba"><option value="Cerveja"><option value="Dose"><option value="Refrigerante"><option value="Água"></datalist>
  <div class="row2"><div><label>Quantidade</label><input id="vq" type="number" min="1" value="1" inputmode="numeric"></div><div><label>Valor unitário</label><input id="vp" type="number" min="0" step="0.01" inputmode="decimal"></div></div>
  <label>Pagamento</label><select id="vm" onchange="$('#vc').classList.toggle('hide',this.value!=='Fiado')"><option>Dinheiro</option><option>Pix</option><option>Cartão</option><option>Fiado</option></select>
  <div id="vc" class="hide"><label>Nome do cliente (fiado)</label><input id="vn"></div>
  <button class="btn full" onclick="addSale()">Registrar venda</button></div>
  <div class="card"><b>Histórico</b><div class="list">${D.sales.slice(0, 60).map(s => `<div><div class="t"><b>${esc(s.desc)}${s.qty > 1 ? ' ×' + s.qty : ''}</b><small>${fd(s.date)} · ${esc(s.pay)}</small></div><div class="v ${s.pay === 'Fiado' ? 'y' : 'g'}">${R(s.total)}</div><button class="btn d s" onclick="delSale('${s.id}')">✕</button></div>`).join('') || '<div class="empty">Nenhuma venda registrada.</div>'}</div></div>`;
}
function autoP() { const p = D.stock.find(x => x.name.toLowerCase() === $('#vi').value.trim().toLowerCase()); if (p)
    $('#vp').value = p.price; }
function addSale() {
    const name = $('#vi').value.trim(), q = parseInt($('#vq').value) || 0, pr = parseFloat($('#vp').value), pay = $('#vm').value, cl = $('#vn').value.trim();
    if (!name || q < 1 || !(pr >= 0))
        return alert('Preencha item, quantidade e valor.');
    if (pay === 'Fiado' && !cl)
        return alert('Informe o nome do cliente do fiado.');
    const p = D.stock.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (p) {
        if (p.qty < q)
            return alert('Estoque insuficiente: restam ' + p.qty + ' un.');
        p.qty -= q;
    }
    const total = +(q * pr).toFixed(2);
    D.sales.unshift({ id: uid(), desc: name, qty: q, total, pay, date: new Date().toISOString() });
    if (pay === 'Fiado')
        D.fiado.unshift({ id: uid(), client: cl, desc: name + (q > 1 ? ' ×' + q : ''), value: total, date: new Date().toISOString() });
    save();
    render();
}
function delSale(id) { if (confirm('Apagar esta venda?')) {
    D.sales = D.sales.filter(s => s.id !== id);
    save();
    render();
} }
function vEstoque() {
    return `<h2>Estoque</h2><p class="sub">Produtos disponíveis</p>
  <div class="card"><label style="margin-top:0">Produto</label><input id="en" placeholder="Ex: Pomada modeladora">
  <div class="row2"><div><label>Quantidade</label><input id="eq" type="number" min="0" value="1" inputmode="numeric"></div><div><label>Preço de venda</label><input id="ep" type="number" min="0" step="0.01" inputmode="decimal"></div></div>
  <button class="btn full" onclick="addStock()">Adicionar ao estoque</button></div>
  <div class="card"><div class="list">${D.stock.map(p => `<div><div class="t"><b>${esc(p.name)}</b><small>${R(p.price)}</small></div><div class="qty"><button onclick="qtyS('${p.id}',-1)">−</button><b style="min-width:26px;text-align:center;color:${p.qty <= CFG.lowStock ? 'var(--bad)' : 'var(--tx)'}">${p.qty}</b><button onclick="qtyS('${p.id}',1)">+</button></div><button class="btn d s" onclick="delStock('${p.id}')">✕</button></div>`).join('') || '<div class="empty">Estoque vazio.</div>'}</div></div>`;
}
function addStock() {
    const n = $('#en').value.trim(), q = parseInt($('#eq').value) || 0, pr = parseFloat($('#ep').value) || 0;
    if (!n || q < 0)
        return alert('Informe o nome e a quantidade.');
    const p = D.stock.find(x => x.name.toLowerCase() === n.toLowerCase());
    if (p) {
        p.qty += q;
        if (pr)
            p.price = pr;
    }
    else
        D.stock.push({ id: uid(), name: n, qty: q, price: pr });
    D.stock.sort((a, b) => a.name.localeCompare(b.name));
    save();
    render();
}
function qtyS(id, d) { const p = D.stock.find(x => x.id === id); p.qty = Math.max(0, p.qty + d); save(); render(); }
function delStock(id) { if (confirm('Remover este produto?')) {
    D.stock = D.stock.filter(p => p.id !== id);
    save();
    render();
} }
function vFiado() {
    return `<h2>Fiado</h2><p class="sub">Quem está devendo e quem já pagou</p>
  <div class="card"><label style="margin-top:0">Cliente</label><input id="fc">
  <div class="row2"><div><label>O que levou</label><input id="fd"></div><div><label>Valor</label><input id="fv" type="number" min="0" step="0.01" inputmode="decimal"></div></div>
  <button class="btn full" onclick="addFiado()">Anotar fiado</button></div>
  <div class="card"><b>A receber · ${R(D.fiado.reduce((t, f) => t + f.value, 0))}</b><div class="list">${D.fiado.map(f => `<div><div class="t"><b>${esc(f.client)}</b><small>${esc(f.desc)} · ${fd(f.date)}</small></div><div class="v y">${R(f.value)}</div><button class="btn ok s" onclick="payF('${f.id}')">Pago</button><button class="btn d s" onclick="delF('${f.id}')">✕</button></div>`).join('') || '<div class="empty">Ninguém devendo 🎉</div>'}</div></div>
  <div class="card"><div style="display:flex;align-items:center"><b style="flex:1">Já pagos · ${R(D.paid.reduce((t, f) => t + f.value, 0))}</b>${D.paid.length ? '<button class="btn d s" onclick="clearPaid()">Apagar todos</button>' : ''}</div><div class="list">${D.paid.map(f => `<div><div class="t"><b>${esc(f.client)}</b><small>${esc(f.desc)} · pago em ${fd(f.paidAt)}</small></div><div class="v g">${R(f.value)}</div><button class="btn d s" onclick="delP('${f.id}')">✕</button></div>`).join('') || '<div class="empty">Nenhum pagamento ainda.</div>'}</div></div>`;
}
function addFiado() {
    const c = $('#fc').value.trim(), d = $('#fd').value.trim(), v = parseFloat($('#fv').value);
    if (!c || !d || !(v > 0))
        return alert('Preencha cliente, item e valor.');
    D.fiado.unshift({ id: uid(), client: c, desc: d, value: v, date: new Date().toISOString() });
    save();
    render();
}
function payF(id) {
    const f = D.fiado.find(x => x.id === id);
    if (!f)
        return;
    D.fiado = D.fiado.filter(x => x.id !== id);
    const now = new Date().toISOString();
    D.paid.unshift({ ...f, paidAt: now });
    D.sales.unshift({ id: uid(), desc: 'Fiado pago – ' + f.client, qty: 1, total: f.value, pay: 'Fiado pago', date: now });
    save();
    render();
}
function delF(id) { if (confirm('Apagar este fiado sem receber?')) {
    D.fiado = D.fiado.filter(f => f.id !== id);
    save();
    render();
} }
function delP(id) { if (confirm('Apagar este registro pago?')) {
    D.paid = D.paid.filter(f => f.id !== id);
    save();
    render();
} }
function clearPaid() { if (confirm('Apagar TODOS os fiados já pagos?')) {
    D.paid = [];
    save();
    render();
} }
let C = { a: null, op: null, cur: '0', fresh: true };
const num = s => parseFloat(String(s).replace(',', '.')) || 0, fmt = n => String(+n.toFixed(8)).replace('.', ',');
function vCalc() {
    const k = ['C', '⌫', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', ',', '=', ''];
    return `<h2>Calculadora</h2><p class="sub">Contas rápidas e troco</p>
  <div class="card calc"><div id="ce"></div><div id="cd">${C.cur}</div><div class="keys">${k.slice(0, 16).map(x => `<button class="${'÷×−+'.includes(x) ? 'o' : ''}" onclick="key('${x}')">${x}</button>`).join('')}
  <button onclick="key('0')" style="grid-column:span 2">0</button><button onclick="key(',')">,</button><button class="eq" onclick="key('=')">=</button></div></div>
  <div class="card calc"><b>Troco</b><div class="row2"><div><label>Total</label><input id="t1" type="number" step="0.01" inputmode="decimal" oninput="troco()"></div><div><label>Recebido</label><input id="t2" type="number" step="0.01" inputmode="decimal" oninput="troco()"></div></div><div class="tbig" id="tr" style="margin-top:12px">R$ 0,00</div></div>`;
}
function key(k) {
    if (/\d/.test(k)) {
        C.cur = (C.fresh || C.cur === '0') ? k : C.cur + k;
        C.fresh = false;
    }
    else if (k === ',') {
        if (C.fresh) {
            C.cur = '0,';
            C.fresh = false;
        }
        else if (!C.cur.includes(','))
            C.cur += ',';
    }
    else if (k === 'C')
        C = { a: null, op: null, cur: '0', fresh: true };
    else if (k === '⌫')
        C.cur = C.cur.length > 1 ? C.cur.slice(0, -1) : '0';
    else if (k === '%')
        C.cur = fmt(num(C.cur) / 100);
    else {
        if ((C.op && !C.fresh) || (k === '=' && C.op)) {
            const b = num(C.cur), a = C.a;
            C.a = C.op === '+' ? a + b : C.op === '−' ? a - b : C.op === '×' ? a * b : (b ? a / b : 0);
            C.cur = fmt(C.a);
        }
        else
            C.a = num(C.cur);
        C.op = k === '=' ? null : k;
        C.fresh = true;
    }
    $('#cd').textContent = C.cur;
    $('#ce').textContent = C.op ? fmt(C.a) + ' ' + C.op : '';
}
function troco() { const t = num($('#t1').value), r = num($('#t2').value); $('#tr').textContent = r >= t ? R(r - t) : 'Faltam ' + R(t - r); }
function vEquipe() {
    const own = pid === me.id, owner = users.find(u => u.id === pid) || { name: '?' };
    if (!own)
        return `<h2>Equipe</h2><p class="sub">Você está no painel de <b>${esc(owner.name)}</b>. Só o dono pode gerenciar a equipe.</p>`;
    const mem = users.filter(u => u.id !== pid && u.access.includes(pid));
    return `<h2>Equipe</h2><p class="sub">Adicione quem pode acessar o seu painel</p>
  <div class="card"><label style="margin-top:0">Usuário da pessoa (ela precisa ter se registrado)</label><input id="mu" autocapitalize="none" placeholder="ex: joao_nr"><button class="btn full" onclick="addMem()">Dar acesso ao meu painel</button><div class="err" id="me"></div></div>
  <div class="card"><b>Com acesso</b><div class="list">${mem.map(u => `<div><div class="t"><b>${esc(u.name)}</b><small>@${esc(u.user)}</small></div><button class="btn d s" onclick="rmMem('${u.id}')">Remover</button></div>`).join('') || '<div class="empty">Só você tem acesso.</div>'}</div></div>`;
}
function addMem() {
    const u = users.find(x => x.user === $('#mu').value.trim().toLowerCase());
    if (!u)
        return $('#me').textContent = 'Usuário não encontrado. Peça para a pessoa se registrar primeiro.';
    if (u.access.includes(pid))
        return $('#me').textContent = 'Essa pessoa já tem acesso.';
    u.access.push(pid);
    ls.set('nr_users', users);
    render();
}
function rmMem(id) { const u = users.find(x => x.id === id); if (u && confirm('Remover o acesso de ' + u.name + '?')) {
    u.access = u.access.filter(p => p !== pid);
    ls.set('nr_users', users);
    render();
} }
function vBackup() {
    if (pid !== me.id)
        return '<h2>Backup</h2><p class="sub">Só o dono do painel pode fazer ou restaurar backups.</p>';
    const last = ls.get('nr_lastbk_' + me.id, null);
    return `<h2>Backup</h2><p class="sub">Proteja seus dados contra perda</p>
  <div class="card"><b>Baixar backup</b><p class="sub" style="margin:6px 0 0">Gera um arquivo .json com vendas, estoque e fiado. Guarde em lugar privado (Drive, e-mail).</p><button class="btn full" onclick="exportBk()">Baixar backup agora</button><p class="note">${last ? 'Último backup: ' + fd(last) : 'Nenhum backup feito ainda.'}</p></div>
  <div class="card"><b>Restaurar backup</b><p class="sub" style="margin:6px 0 10px">Substitui os dados deste painel pelos do arquivo.</p><input type="file" id="bf" accept=".json,application/json"><button class="btn g full" onclick="importBk()">Restaurar</button><div class="err" id="be"></div></div>
  <p class="note">O app também guarda uma cópia automática interna a cada alteração e recupera sozinho se os dados principais corromperem.</p>`;
}
function exportBk() {
    const o = { app: 'barbearia-nr', version: 1, date: new Date().toISOString(), owner: { id: me.id, name: me.name, user: me.user, salt: me.salt, hash: me.hash }, data: D };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' }));
    a.download = 'backup_barbearianr_' + dk(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    ls.set('nr_lastbk_' + me.id, new Date().toISOString());
    render();
}
function chkBk(o) {
    if (!o || o.app !== 'barbearia-nr' || !o.owner || !o.data)
        return false;
    const w = o.owner;
    if (!/^u_[\w-]+$/.test(w.id || '') || !/^[a-z0-9_.]{3,20}$/.test(w.user || '') || !/^[0-9a-f]{64}$/.test(w.hash || '') || !w.salt || !w.name)
        return false;
    return ['sales', 'stock', 'fiado', 'paid'].every(k => Array.isArray(o.data[k]));
}
async function importBk() {
    const f = $('#bf').files[0], e = $('#be');
    e.textContent = '';
    if (!f)
        return e.textContent = 'Escolha um arquivo.';
    try {
        const o = JSON.parse(await f.text());
        if (!chkBk(o))
            return e.textContent = 'Arquivo inválido ou corrompido.';
        if (o.owner.id !== me.id)
            return e.textContent = 'Este backup é de outro painel.';
        if (!confirm('Substituir os dados atuais pelo backup de ' + fd(o.date) + '?'))
            return;
        D = Object.assign(empty(), o.data);
        save();
        render();
        alert('Backup restaurado!');
    }
    catch (x) {
        e.textContent = 'Arquivo inválido ou corrompido.';
    }
}
async function importAuth(inp) {
    const f = inp.files[0];
    inp.value = '';
    if (!f)
        return;
    try {
        const o = JSON.parse(await f.text());
        if (!chkBk(o))
            return $('#ae').textContent = 'Arquivo inválido ou corrompido.';
        const w = o.owner;
        if (users.some(u => u.id === w.id || u.user === w.user))
            return $('#ae').textContent = 'Essa conta já existe neste aparelho. Entre e restaure pela aba Backup.';
        users.push({ id: w.id, name: w.name, user: w.user, salt: w.salt, hash: w.hash, access: [w.id] });
        ls.set('nr_users', users);
        ls.set('nr_d_' + w.id, Object.assign(empty(), o.data));
        $('#ae').textContent = '';
        alert('Backup restaurado! Entre com o usuário "' + w.user + '" e a mesma senha de antes.');
    }
    catch (x) {
        $('#ae').textContent = 'Arquivo inválido ou corrompido.';
    }
}
(async () => {
    await IDB.open();
    const old = await IDB.all();
    for (const k in old)
        if (k.startsWith('nr_') && localStorage.getItem(k) == null && localStorage.getItem(k + '__bk') == null)
            try {
                localStorage.setItem(k, old[k]);
            }
            catch (e) { }
    seed();
    try {
        navigator.storage && navigator.storage.persist && navigator.storage.persist();
    }
    catch (e) { }
    boot();
})();

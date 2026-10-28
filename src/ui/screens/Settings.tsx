import { useState } from 'preact/hooks';
import { act, useData, wipeAll } from '../../store/store';
import * as calc from '../../domain/calc';
import * as ops from '../../domain/ops';
import { fmtDate, today } from '../../domain/dates';
import { parseMoney } from '../../domain/money';
import { money } from '../format';
import { Icon } from '../icons';
import { Card, confirmDialog, Field, MoneyInput, moneyStr, PageHeader, toast } from '../components/kit';
import { checkReminders, notifSupported, requestNotifications } from '../../notifications';

export function Settings() {
  const d = useData();
  const s = d.settings;
  const [v, setV] = useState({ name: s.name || '', salary: moneyStr(s.salary), payday: String(s.payday), vaMonthly: moneyStr(s.vaMonthly), vaDay: String(s.vaDay), vaAlert: String(s.vaAlertPercent), notifyDays: String(s.notifyDaysBefore) });
  const [bank, setBank] = useState('');
  const [perm, setPerm] = useState(notifSupported() ? Notification.permission : 'unsupported');
  const f = (k: keyof typeof v) => (e: Event) => setV({ ...v, [k]: (e.target as HTMLInputElement).value });
  const toggle = (k: 'vaCarryOver' | 'salaryAuto' | 'privacy') => act((x) => ops.updateSettings(x, { [k]: !x.settings[k] }));
  const save = (e: Event) => {
    e.preventDefault();
    const salary = v.salary ? parseMoney(v.salary) : 0;
    const vaMonthly = v.vaMonthly ? parseMoney(v.vaMonthly) : 0;
    if (isNaN(salary) || isNaN(vaMonthly)) return toast('Valor inválido', 'err');
    const msg = act((x) => ops.updateSettings(x, { name: v.name.trim() || undefined, salary, vaMonthly, payday: parseInt(v.payday, 10), vaDay: Math.min(31, Math.max(1, parseInt(v.vaDay, 10) || 1)), vaAlertPercent: Math.min(100, Math.max(1, parseInt(v.vaAlert, 10) || 80)), notifyDaysBefore: parseInt(v.notifyDays, 10) }));
    if (msg) toast(msg, 'err'); else toast('Configurações salvas');
  };
  const enableNotif = async () => {
    if (s.notifications) { act((x) => ops.updateSettings(x, { notifications: false })); return; }
    const p = await requestNotifications();
    setPerm(p);
    if (p === 'granted') { act((x) => ops.updateSettings(x, { notifications: true })); const n = await checkReminders(); toast(n ? `${n} lembrete(s) enviados` : 'Lembretes ativados'); }
    else toast(p === 'unsupported' ? 'Este navegador não suporta notificações' : 'Permissão negada. Os lembretes continuam dentro do app.', 'err');
  };
  const calcBal = calc.accountBalance(d);
  const informed = bank ? parseMoney(bank) : NaN;
  const adjust = async () => {
    if (isNaN(informed)) return;
    if (!(await confirmDialog({ title: 'Lançar ajuste de saldo?', text: `Será criado um ajuste de ${money(informed - calcBal)} para o saldo calculado ficar igual ao do banco. Ajustes não contam como receita nem despesa.`, ok: 'Ajustar' }))) return;
    act((x) => ops.adjustBalance(x, informed, calcBal, today()));
    setBank(''); toast('Saldo ajustado');
  };
  const leaveDemo = async () => {
    if (!(await confirmDialog({ title: 'Sair da demonstração?', text: 'Todos os dados de exemplo serão apagados e você começa a configuração com seus valores reais.', ok: 'Remover demo', danger: true }))) return;
    await wipeAll(); location.hash = '#/inicio';
  };
  return (
    <div class="page">
      <PageHeader back title="Perfil e configurações" />
      {s.demo && <Card class="tint-warn"><p><b>Modo demonstração.</b> Os valores são fictícios.</p><button class="btn primary block" type="button" onClick={leaveDemo}>Remover dados de demonstração e começar</button></Card>}
      <form onSubmit={save}>
        <Card title="Salário e VA">
          <div class="stack">
            <Field label="Seu nome (opcional)"><input name="nome" value={v.name} onInput={f('name')} /></Field>
            <div class="grid2">
              <Field label="Salário líquido"><MoneyInput name="salario" value={v.salary} onChange={(x) => setV({ ...v, salary: x })} /></Field>
              <Field label="Dia do pagamento"><input name="dia-pagamento" type="number" min={1} max={31} inputMode="numeric" value={v.payday} onInput={f('payday')} /></Field>
            </div>
            <label class="check"><input type="checkbox" checked={s.salaryAuto} onChange={() => toggle('salaryAuto')} /> Criar o salário previsto todo mês (você confirma quando cair)</label>
            <div class="grid2">
              <Field label="VA mensal"><MoneyInput name="va" value={v.vaMonthly} onChange={(x) => setV({ ...v, vaMonthly: x })} /></Field>
              <Field label="Dia do crédito do VA"><input name="dia-va" type="number" min={1} max={31} inputMode="numeric" value={v.vaDay} onInput={f('vaDay')} /></Field>
            </div>
            <label class="check"><input type="checkbox" checked={s.vaCarryOver} onChange={() => toggle('vaCarryOver')} /> Saldo do VA que sobra passa para o mês seguinte</label>
            <Field label="Avisar quando o VA passar de (%)"><input name="alerta-va" type="number" min={1} max={100} inputMode="numeric" value={v.vaAlert} onInput={f('vaAlert')} /></Field>
            <button class="btn primary block" type="submit">Salvar</button>
          </div>
        </Card>
        <Card title="Lembretes">
          <div class="stack">
            <Field label="Avisar quantos dias antes do vencimento"><input name="dias-antes" type="number" min={0} max={15} inputMode="numeric" value={v.notifyDays} onInput={f('notifyDays')} /></Field>
            <button class={`btn ${s.notifications ? 'soft' : 'primary'} block`} type="button" onClick={enableNotif}><Icon name="bell" size={18} /> {s.notifications ? 'Desativar notificações' : 'Ativar notificações do sistema'}</button>
            <p class="muted small">Permissão: {perm === 'granted' ? 'concedida' : perm === 'denied' ? 'negada (mude nas configurações do navegador)' : perm === 'unsupported' ? 'não suportada neste navegador' : 'ainda não pedida'}.</p>
            <p class="note"><Icon name="info" size={16} /> O app verifica as contas quando é aberto e a cada 30 minutos enquanto está aberto, avisando no dia e {s.notifyDaysBefore} dia(s) antes. <b>Navegadores não garantem notificações com o app totalmente fechado</b> — por isso os avisos também aparecem na tela inicial. Abra o app uma vez por dia para não perder nada. Para alarmes garantidos, use também a agenda do celular ou, no futuro, a versão APK.</p>
            <button class="btn ghost block" type="button" onClick={() => { act((x) => ({ ...x, notified: [] })); void checkReminders().then((n) => toast(n ? `${n} lembrete(s) enviados` : 'Nenhum lembrete pendente agora')); }}>Testar lembretes agora</button>
          </div>
        </Card>
      </form>
      <Card title="Saldo da conta">
        <p class="small">Saldo calculado pelo app: <b data-testid="saldo-calculado">{money(calcBal)}</b></p>
        <p class="muted small">Ponto de partida: {money(s.initialBalance)} em {fmtDate(s.initialBalanceDate)}. Só lançamentos realizados a partir dessa data entram no cálculo.</p>
        <Field label="Saldo que aparece no banco hoje"><MoneyInput name="saldo-banco" value={bank} onChange={setBank} /></Field>
        {!isNaN(informed) && <p class="small">Diferença: <b class={informed - calcBal >= 0 ? 'pos' : 'neg'}>{money(informed - calcBal)}</b></p>}
        <button class="btn soft block" type="button" disabled={isNaN(informed) || informed === calcBal} onClick={adjust}>Conferir e ajustar</button>
      </Card>
      <Card title="Aparência e privacidade">
        <div class="stack-sm">
          <label class="check"><input type="checkbox" checked={s.theme === 'dark'} onChange={() => act((x) => ({ ...x, settings: { ...x.settings, theme: x.settings.theme === 'dark' ? 'light' : 'dark' } }))} /> Tema escuro</label>
          <label class="check"><input type="checkbox" checked={s.privacy} onChange={() => toggle('privacy')} /> Ocultar valores (modo privacidade)</label>
        </div>
      </Card>
    </div>
  );
}

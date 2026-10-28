import { useState } from 'preact/hooks';
import { getData, replaceAll, useData, wipeAll } from '../../store/store';
import { makeBackup, parseBackup } from '../../domain/backup';
import { fmtDate, today } from '../../domain/dates';
import { Icon } from '../icons';
import { Card, confirmDialog, PageHeader, toast } from '../components/kit';
import { download } from '../download';

export function Backup() {
  const d = useData();
  const [errors, setErrors] = useState<string[]>([]);
  const exp = () => {
    download(`meu-financeiro-backup-${today()}.json`, JSON.stringify(makeBackup(getData()), null, 1), 'application/json');
    localStorage.setItem('mf-last-backup', today());
    toast('Backup exportado');
  };
  const imp = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const text = await file.text();
    const r = parseBackup(text);
    if (!r.ok) { setErrors(r.errors); toast('Backup inválido', 'err'); return; }
    setErrors([]);
    const n = r.data.movements.length;
    if (!(await confirmDialog({ title: 'Substituir os dados atuais?', text: `O backup tem ${n} lançamento(s), ${r.data.bills.length} conta(s) e ${r.data.lists.length} lista(s). Tudo que está no app agora será substituído.`, ok: 'Restaurar', danger: true }))) return;
    await replaceAll(r.data);
    toast('Backup restaurado');
  };
  const wipe = async () => {
    if (!(await confirmDialog({ title: 'Apagar todos os dados?', text: 'Isso remove lançamentos, contas, listas e configurações deste aparelho. Não dá para desfazer. Exporte um backup antes se quiser guardar.', ok: 'Apagar tudo', danger: true, typeToConfirm: 'APAGAR' }))) return;
    await wipeAll();
    toast('Dados apagados');
    location.hash = '#/inicio';
  };
  const last = localStorage.getItem('mf-last-backup');
  return (
    <div class="page">
      <PageHeader back title="Backup e restauração" subtitle="Seus dados ficam só neste aparelho" />
      <Card class="tint-teal">
        <p><Icon name="info" size={18} /> Os dados ficam salvos automaticamente no navegador deste aparelho (IndexedDB). <b>Se você limpar os dados do navegador/app ou desinstalar, tudo é perdido.</b> Exporte um backup de vez em quando e guarde no Drive, e-mail ou computador.</p>
        <p class="muted small">Último backup exportado: {last ? fmtDate(last) : 'nunca'} · {d.movements.length} lançamentos · {d.bills.length} contas</p>
      </Card>
      <Card title="Exportar">
        <button class="btn primary block" type="button" onClick={exp}><Icon name="download" size={18} /> Exportar backup (JSON)</button>
        <p class="muted small">O arquivo é gerado aqui mesmo. Nada é enviado para servidores ou terceiros.</p>
      </Card>
      <Card title="Restaurar">
        <label class="btn soft block file-btn"><Icon name="upload" size={18} /> Escolher arquivo de backup<input type="file" accept="application/json,.json" aria-label="Arquivo de backup" onChange={imp} /></label>
        {errors.length > 0 && <ul class="err-list">{errors.map((e) => <li>{e}</li>)}</ul>}
        <p class="muted small">O arquivo é validado antes. Você confirma antes de substituir os dados atuais.</p>
      </Card>
      <Card title="Zona de cuidado">
        <button class="btn ghost block danger-text" type="button" onClick={wipe}><Icon name="trash" size={18} /> Apagar todos os dados</button>
      </Card>
    </div>
  );
}

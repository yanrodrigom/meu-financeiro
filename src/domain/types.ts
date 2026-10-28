// Modelo de dados do Meu Financeiro. Valores monetários sempre em CENTAVOS (inteiros).
// Datas no formato ISO local 'AAAA-MM-DD'; meses 'AAAA-MM'.

export type ISODate = string;
export type Month = string;

export type MovementType = 'receita' | 'despesa' | 'reserva_deposito' | 'reserva_retirada' | 'ajuste';
/** conta = dinheiro do salário/conta bancária; va = vale-alimentação; outra = cartão/terceiros, não afeta saldo da conta nem VA */
export type MoneySource = 'conta' | 'va' | 'outra';
export type MovementStatus = 'prevista' | 'pendente' | 'realizada' | 'paga';
export type OriginType = 'manual' | 'conta' | 'compras' | 'salario' | 'reserva' | 'ajuste';

export interface Movement {
  id: string;
  description: string;
  type: MovementType;
  amount: number; // centavos, sempre >= 0 (ajuste pode ser negativo)
  date: ISODate;
  category: string;
  source: MoneySource;
  status: MovementStatus;
  paymentMethod?: string;
  recurrence?: 'fixa' | 'variavel';
  notes?: string;
  originType: OriginType;
  originId?: string;
  createdAt: string;
  updatedAt: string;
}

export type BillSource = 'salario' | 'va' | 'outra';
export type BillKind = 'fixa' | 'parcela' | 'compra' | 'eventual';
export type Recurrence = 'nenhuma' | 'semanal' | 'quinzenal' | 'mensal' | 'anual';
export type BillStatus = 'pendente' | 'paga' | 'cancelada';

export interface Bill {
  id: string;
  name: string;
  amount: number; // valor previsto
  dueDate: ISODate;
  category: string;
  source: BillSource;
  kind: BillKind;
  recurrence: Recurrence;
  seriesId?: string;
  installment?: { groupId: string; n: number; total: number };
  notes?: string;
  status: BillStatus;
  paidAmount?: number;
  paidDate?: ISODate;
  movementId?: string;
  createdAt: string;
  updatedAt: string;
}

/** Modelo de uma conta recorrente. Ocorrências têm id determinístico `${seriesId}@${data}`. */
export interface BillSeries {
  id: string;
  name: string;
  amount: number;
  category: string;
  source: BillSource;
  kind: BillKind;
  recurrence: Exclude<Recurrence, 'nenhuma'>;
  startDate: ISODate;
  endDate?: ISODate;
  notes?: string;
  skipped: ISODate[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  qty: number;
  unit: string;
  estPrice: number; // preço unitário previsto (centavos)
  realPrice?: number; // preço unitário pago (centavos)
  market?: string;
  notes?: string;
  status: 'pendente' | 'comprado';
  boughtAt?: ISODate;
}

export interface ShoppingList {
  id: string;
  month: Month;
  name: string;
  items: ShoppingItem[];
  createdAt: string;
}

export interface ReserveConfig {
  initialAmount: number; // valor que já existia na reserva antes do app
  targetMonths: number;
  essentialMonthly: number;
  monthlyContribution: number;
  customTarget?: number;
  deadline?: ISODate;
}

export interface MonthPlan {
  extras: number;
  variable: number;
  savingsGoal: number;
}

export interface Settings {
  onboarded: boolean;
  demo: boolean;
  name?: string;
  salary: number;
  payday: number; // 1-31
  vaMonthly: number;
  vaDay: number;
  vaCarryOver: boolean;
  vaStartMonth: Month;
  initialBalance: number; // saldo bancário informado no início
  initialBalanceDate: ISODate;
  theme: 'light' | 'dark';
  privacy: boolean;
  notifications: boolean;
  notifyDaysBefore: number;
  salaryAuto: boolean;
  skippedSalary: Month[];
  vaAlertPercent: number;
  defaultVariable: number;
  defaultSavingsGoal: number;
}

export interface AppData {
  schemaVersion: 1;
  settings: Settings;
  movements: Movement[];
  bills: Bill[];
  series: BillSeries[];
  lists: ShoppingList[];
  frequentItems: { name: string; category: string; unit: string; estPrice: number }[];
  reserve: ReserveConfig;
  plans: Record<Month, MonthPlan>;
  notified: string[];
}

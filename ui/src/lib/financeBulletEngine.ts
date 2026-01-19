import type { FinanceInputValue, FinanceSimulationInputs } from "./financeSimulation";

type BulletRow = {
  month: number;
  eventsTranche: number;
  eventsStructuringFee: number;
  eventsFinancedExpense: number;
  eventsTotal: number;
  saldoBase: number;
  juros: number;
  seguro: number;
  gestao: number;
  parcela: number;
  principalPago: number;
  pagamentoTotal: number;
};

type BulletKpis = {
  saldoBaseFinal: number;
  totalJuros: number;
  totalSeguro: number;
  totalGestao: number;
  pagamentoTotalVencimento: number;
  totalPagoContrato: number;
};

type BulletScheduleResult =
  | {
      rows: BulletRow[];
      kpis: BulletKpis;
      termMonths: number;
    }
  | { error: string };

const toNumber = (value: FinanceInputValue) => {
  if (value === "") {
    return 0;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return 0;
  }
  return numeric;
};

const toMonthValue = (value: FinanceInputValue) => {
  if (value === "") {
    return null;
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return Math.trunc(numeric);
};

type MonthEventMap = Map<
  number,
  {
    tranche: number;
    structuringFee: number;
    financedExpense: number;
  }
>;

const addEvent = (
  map: MonthEventMap,
  month: number,
  type: "tranche" | "structuringFee" | "financedExpense",
  amount: number,
) => {
  const current = map.get(month) ?? { tranche: 0, structuringFee: 0, financedExpense: 0 };
  map.set(month, { ...current, [type]: current[type] + amount });
};

export const buildBulletSchedule = (
  inputs: FinanceSimulationInputs,
): BulletScheduleResult => {
  if (inputs.construction_months === "" || inputs.grace_months === "") {
    return { error: "Preencha prazo de obra e carência para calcular o resultado." };
  }

  const termMonths = Math.max(
    0,
    Math.trunc(toNumber(inputs.construction_months) + toNumber(inputs.grace_months)),
  );

  const eventsByMonth: MonthEventMap = new Map();

  const financedExpenseAmount = toNumber(inputs.financed_expenses_amount);
  if (financedExpenseAmount !== 0 && termMonths >= 0) {
    addEvent(eventsByMonth, 0, "financedExpense", financedExpenseAmount);
  }

  const tranches = inputs.financed_is_parceled
    ? inputs.financed_tranches
    : [{ month: 0, amount: inputs.financed_value }];

  tranches.forEach((tranche) => {
    const monthValue = toMonthValue(tranche.month);
    if (monthValue === null || monthValue < 0 || monthValue > termMonths) {
      return;
    }
    const amountValue = toNumber(tranche.amount);
    if (amountValue === 0) {
      return;
    }
    addEvent(eventsByMonth, monthValue, "tranche", amountValue);
  });

  inputs.structuring_fee_installments.forEach((installment) => {
    const monthValue = toMonthValue(installment.month);
    if (monthValue === null || monthValue < 0 || monthValue > termMonths) {
      return;
    }
    const amountValue = toNumber(installment.amount);
    if (amountValue === 0) {
      return;
    }
    addEvent(eventsByMonth, monthValue, "structuringFee", amountValue);
  });

  const fixedRate = toNumber(inputs.fixed_rate_am);
  const insuranceRate = toNumber(inputs.insurance_pct) / 100;
  const managementValues = inputs.management_fee_values;
  const hasFullManagementValues = managementValues.length >= termMonths;

  const rows: BulletRow[] = [];
  let saldoBase = 0;
  let totalJuros = 0;
  let totalSeguro = 0;
  let totalGestao = 0;
  let totalPagoContrato = 0;

  for (let month = 0; month <= termMonths; month += 1) {
    const events = eventsByMonth.get(month) ?? {
      tranche: 0,
      structuringFee: 0,
      financedExpense: 0,
    };
    const eventsTotal = events.tranche + events.structuringFee + events.financedExpense;

    if (month === 0) {
      saldoBase = eventsTotal;
    } else {
      saldoBase += eventsTotal;
    }

    const juros = month === 0 ? 0 : saldoBase * fixedRate;
    const seguro = month === 0 ? 0 : saldoBase * insuranceRate;
    const gestao =
      month === 0 || !hasFullManagementValues
        ? 0
        : toNumber(managementValues[month - 1] ?? 0);
    const parcela = month === 0 ? 0 : juros + seguro + gestao;

    if (month > 0) {
      totalJuros += juros;
      totalSeguro += seguro;
      totalGestao += gestao;
      totalPagoContrato += parcela;
    }

    rows.push({
      month,
      eventsTranche: events.tranche,
      eventsStructuringFee: events.structuringFee,
      eventsFinancedExpense: events.financedExpense,
      eventsTotal,
      saldoBase,
      juros,
      seguro,
      gestao,
      parcela,
      principalPago: 0,
      pagamentoTotal: month === 0 ? 0 : parcela,
    });
  }

  if (rows.length > 0) {
    const lastRow = rows[rows.length - 1];
    lastRow.principalPago = lastRow.saldoBase;
    lastRow.pagamentoTotal = lastRow.parcela + lastRow.principalPago;
    if (termMonths > 0) {
      totalPagoContrato += lastRow.principalPago;
    }
  }

  const saldoBaseFinal = rows.length > 0 ? rows[rows.length - 1].saldoBase : 0;
  const pagamentoTotalVencimento = rows.length > 0 ? rows[rows.length - 1].pagamentoTotal : 0;

  return {
    rows,
    kpis: {
      saldoBaseFinal,
      totalJuros,
      totalSeguro,
      totalGestao,
      pagamentoTotalVencimento,
      totalPagoContrato,
    },
    termMonths,
  };
};

export type { BulletRow, BulletKpis, BulletScheduleResult };

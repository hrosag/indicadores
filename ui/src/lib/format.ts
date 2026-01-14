export const formatPercentBR = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
};

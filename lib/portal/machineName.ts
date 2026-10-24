export const MACHINE_TITLE_MAX_LENGTH = 255;

export const getDefaultMachineTitle = (
  machineId: string | number,
  modelName?: string,
) => {
  const model = (modelName || "Machine")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

  return `#${machineId} ${model || "Machine"}`;
};

import type {
  PortalCatalogProduct,
  PortalMachineCell,
  PortalProduct,
} from "../../types/portal";

type MixProduct = Pick<
  PortalCatalogProduct | PortalProduct,
  "id" | "name" | "is_dependent" | "can_be_added_to"
>;

export type MachineMix = {
  addon: MixProduct;
  addonPosition: number;
  base: MixProduct;
  basePosition: number;
};

export type MachineMixWarning = {
  key: string;
  message: string;
};

export const productRelationIds = (product?: MixProduct | null) =>
  new Set((product?.can_be_added_to || []).map((target) => String(target.id)));

export const getMachineMixes = (cells: PortalMachineCell[]) => {
  const activeCells = cells.filter((cell) => cell.isActive && cell.product);
  const cellsByProductId = new Map(
    activeCells.map((cell) => [String(cell.product!.id), cell]),
  );
  const mixes: MachineMix[] = [];
  const warnings: MachineMixWarning[] = [];

  activeCells.forEach((addonCell) => {
    const addon = addonCell.product!;
    const targetIds = productRelationIds(addon);
    targetIds.forEach((targetId) => {
      const baseCell = cellsByProductId.get(targetId);
      if (baseCell?.product && !baseCell.product.is_dependent) {
        mixes.push({
          addon,
          addonPosition: addonCell.position,
          base: baseCell.product,
          basePosition: baseCell.position,
        });
        return;
      }

      const target = addon.can_be_added_to?.find(
        (candidate) => String(candidate.id) === targetId,
      );
      warnings.push({
        key: `missing-${addon.id}-${targetId}`,
        message: `${addon.name} can go into ${target?.name || "its base drink"}, but ${
          target?.name || "that base drink"
        } isn't in any container.`,
      });
    });

    if (addon.is_dependent && mixes.every((mix) => String(mix.addon.id) !== String(addon.id))) {
      warnings.push({
        key: `orphan-${addon.id}`,
        message: `${addon.name} is add-on only and nothing on this machine accepts it — it will not be sold.`,
      });
    }
  });

  return { mixes, warnings };
};

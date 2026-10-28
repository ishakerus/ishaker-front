# Codex: сиропные контейнеры (концентраты) в портале

27.10.2026. Бэкенд (Strapi, прод `https://admin.ishaker.xyz`) уже задеплоен и проверен на стенде 002.
Киоск (ShakerView) менять не надо — он сиропы умеет с завода. Нужен только фронт портала
(`~/DEV/ishaker/front`, Next 13.5, pages router, Chakra): показать и редактировать сиропные
контейнеры так же, как порошковые.

## Зачем

У Shaker S кроме 4 банок с порошком есть 3 пакета с сиропом, у Shaker Touch — 8 банок и 6 бутылок
сиропа. Сироп — такой же продукт клиента (линия → продукты), только мерится в миллилитрах, а бутылки
бывают разного объёма. Сейчас портал рисует только порошковые слоты (`container_count`) и даёт
переключатель powder/concentrate на каждой ячейке — это больше неверно: что в слоте, решает его номер.

## Как это устроено на машине и в Strapi (не пересматривать, просто принять)

**Нумерация.** Киоск нумерует ВСЕ контейнеры одной последовательностью: сначала порошковые, сразу
за ними сиропные. По этому номеру он решает, сыпать порошок или крутить помпу, поэтому
`machine-cell.position` — это и есть физический номер, и ничего на сервере/портале его не переставляет.

| Модель (`machine-type.name`) | `container_count` | `syrup_container_count` | порошок | сироп |
|---|---|---|---|---|
| shaker s | 4 | 3 | 1–4 | 5–7 |
| shaker touch | 8 | 6 | 1–8 | 9–14 |
| milkshaker | 4 | 0 (пока неизвестно) | 1–4 | — |

Оба поля лежат на `machine-type` (в проде заполнены). Если `syrup_container_count` пустой — считать 0.
Если `container_count` пустой — старый фолбэк по имени (touch → 8, shaker s/milkshaker → 4), он уже
есть в `lib/portal/containerSlots.ts`.

**Категория ячейки.** `machine-cell.cell_category` (`powder` | `concentrate`) сервер теперь ВЫВОДИТ
из позиции при каждом сохранении (lifecycle). Что бы ни прислал портал в `cell_category`, оно будет
перезаписано. Продукт в ячейке обязан совпадать по типу: `product.product_type` (`powder` |
`concentrate`) == категория слота, иначе Strapi отвечает 400:

```json
{"error":{"status":400,"name":"ApplicationError",
  "message":"Position 5 on machine 118 is a syrup container, but product 1516 \"Mojito\" is a powder."}}
```

и на позицию вне диапазона:

```
Machine 118 only has container positions 1 through 7 (4 powder + 3 syrup).
```

**Единицы.** `machine-cell.amount_kg` — килограммы для порошкового слота и ЛИТРЫ для сиропного
(одна и та же decimal-колонка; киоск работает в г/мл и умножает на 1000). Цифры в проде сейчас:
позиция 5 — 0.985 (= 985 мл).

**Ёмкость (новое поле).** `machine-cell.max_amount_kg` — decimal, nullable, в тех же единицах, что
`amount_kg`. Пусто = дефолт модели: 1.5 кг (Shaker S, порошок), 5.5 кг (Touch, порошок), 3 Л (любой
сироп). Сервер клампит `amount_kg` к этой ёмкости и отдаёт её киоску как `maxVolume` (киоск
ограничивает ею ползунок остатка). Бутылки сиропа разные по точкам — поэтому поле нужно именно
на сиропных слотах. Для порошка дефолт модели правильный, поле можно не показывать.
Изменение `max_amount_kg` поднимает `rev` ячейки (как и product/isActive/price/amount_kg) — на
портале ничего делать не надо.

**Линия.** `product-line.product_type` (`powder` | `concentrate`, default `powder`) — новое поле.
Продукт, созданный в линии-концентрате без явного `product_type`, становится `concentrate`
с `serving_unit = ml` (lifecycle в Strapi). Явно присланные значения не трогаются.

**Что уже проверено на 002 (машина 118, клиент bob id 30):** линия Isotonic 220 (`product_type`
concentrate, base 40), продукты 1516 Mojito / 1517 Grapefruit / 1518 Pineapple (concentrate, ml),
ячейки 460/461/462 = позиции 5/6/7, `max_amount_kg` 1 / 0.7 / null. Киоск принял, налив сиропа
(команда помпы) и списание 15 мл отработали, остаток 0.985 Л вернулся в Strapi. Это и есть
тестовый стенд для фронта — ничего создавать не надо, всё уже в проде.

Пример ответа `GET /api/machine-cells?filters[machine][id][$eq]=118&filters[position][$gte]=5`:

```json
{"id":460,"attributes":{"position":5,"amount_kg":0.985,"max_amount_kg":1,"cell_category":"concentrate",
 "rev":0,"local_source":"machine","local_synced_at":"2026-10-27T17:06:21.252Z"}}
{"id":461,"attributes":{"position":6,"amount_kg":0.7,"max_amount_kg":0.7,"cell_category":"concentrate", ...}}
{"id":462,"attributes":{"position":7,"amount_kg":2.5,"max_amount_kg":null,"cell_category":"concentrate", ...}}
```

`GET /api/machine-types/1` → `{"name":"shaker s","container_count":4,"syrup_container_count":3,...}`,
`/2` → `{"name":"shaker touch","container_count":8,"syrup_container_count":6}`.

## Что менять во фронте

Файлы, которые сейчас знают про ячейки (все под `~/DEV/ishaker/front`):
`lib/portal/containerSlots.ts`, `components/portal/machines/MachineCellsSection.tsx`
(рендерится из `components/portal/product-lines/index.tsx:364`),
`components/portal/product-lines/ContainersPreview.tsx`, `pages/api/portal/machines/[id]/cells.ts`,
`services/server/machineCells.ts`, `types/portal.ts`, `types/strapi.ts`,
`components/portal/health/PowdersDialogContent.tsx`, `components/portal/machines/MachineConsumptionSection.tsx`,
`lib/portal/machineHealth.ts`, `pages/admin/presets.tsx` + `pages/api/admin/presets/*`.

### 1. `lib/portal/containerSlots.ts` (+ `containerSlots.test.ts`)

Добавить, не ломая существующие экспорты (их используют presets и health):

```ts
export type MachineTypeContainerSource = {
  container_count?: unknown;
  syrup_container_count?: unknown;
  name?: unknown;
};
export type SlotCategory = "powder" | "concentrate";
export type ContainerSlot = { position: number; category: SlotCategory; unit: "kg" | "L" };

export const DEFAULT_SYRUP_BOTTLE_L = 3;
// настроенное значение (включая явный 0) побеждает; пусто → touch 6, shaker s 3, иначе 0
export const getMachineSyrupContainerCount = (t?: MachineTypeContainerSource | null): number;
// порошок + сироп; null если модель неизвестна
export const getMachineSlotCount = (t?: MachineTypeContainerSource | null): number | null;
// по позиции: "powder" | "concentrate" | null (вне диапазона / модель неизвестна)
export const getSlotCategory = (position: number, t?: MachineTypeContainerSource | null): SlotCategory | null;
export const buildContainerSlots = (t?: MachineTypeContainerSource | null): ContainerSlot[];
// ёмкость ОДНОЙ ячейки в её единицах: max_amount_kg > 0 → оно; сироп → 3; порошок → 1.5 / 5.5
export const getCellCapacity = (
  cell: { position: number; max_amount_kg?: number | null },
  t?: MachineTypeContainerSource | null,
): number;
export const clampCellAmount = (amount: unknown, cell, t): number; // как clampContainerAmountKg, но по getCellCapacity
```

`getLowestFreeContainerSlot` / `isValidContainerSlot` должны принимать общее число слотов
(powder + syrup), а не только порошковых. Это ровно то, что сделано на сервере в
`strapi/src/utils/container-capacity.js` — можно скопировать логику один в один.

### 2. `types/portal.ts`, `types/strapi.ts`

- machine-type: `syrup_container_count?: number | null`.
- `PortalMachineCell`: `max_amount_kg?: number | null`.
- product-line: `product_type?: "powder" | "concentrate"`.

### 3. `services/server/machineCells.ts`

`getMachineCells`: добавить в выборку `max_amount_kg` (сейчас fields не ограничены для самой ячейки —
проверить, что поле приходит). `updateMachineCell` / `createMachineCell`: принимать и слать
`max_amount_kg` (number | null), а `cell_category` больше НЕ слать (сервер выводит сам; если очень
хочется оставить ради старых presets — слать категорию слота по позиции, никогда пользовательскую).

### 4. `pages/api/portal/machines/[id]/cells.ts`

- `containerCount` → `slotCount = getMachineSlotCount(machine.machine_type)`; лимиты
  «1..N» и «ровно N слотов» считать по нему; тексты ошибок: `Choose a physical container slot from
  1 to ${slotCount} (${powder} powder + ${syrup} syrup).`
- `cellCategory` из тела запроса игнорировать; категория = `getSlotCategory(position, machine_type)`;
  если null — 400 `invalid_container_slot`.
- проверка `product.product_type !== category` остаётся (сообщение
  `Container ${position} is a syrup container; choose a concentrate product.` / наоборот).
- `amountKg` клампить через `clampCellAmount` (с учётом `maxAmountKg` из тела).
- новое поле тела `maxAmountKg?: number | null`: null/undefined → null; иначе число > 0, иначе 400
  `invalid_container_capacity`. Для порошковых слотов принимать тоже (не ломать), но UI его не шлёт.
- если Strapi вернул 400 с `error.message` — пробросить текст в `message` (сейчас сообщения киоска/
  lifecycle полезнее генерируемых).

### 5. `components/portal/machines/MachineCellsSection.tsx`

- Слоты строить через `buildContainerSlots(machineType)`, а не `Array.from({length: containerCount})`.
  Проп `containerCount` заменить на `machineType` (или добавить `syrupContainerCount`) — поправить
  вызов в `product-lines/index.tsx`.
- Две группы карточек с подзаголовками: **Powder containers** (1..N) и **Syrup containers**
  (N+1..N+M). Та же карточка, что сейчас; категория — read-only бейдж (`Powder` / `Syrup`).
  **Убрать переключатель powder/concentrate** (строки ~460–500) и `cellCategory` из `updateCell`.
- Пикер продукта фильтровать по `product.product_type === slot.category`
  (концентраты в сиропных слотах, порошки в порошковых). Существующая проверка
  `no_product_type` остаётся как страховка.
- Единицы: подпись и формат количества по слоту — `kg` / `L` (например `0.985 L`, `1.05 kg`).
  `defaultAssignedAmountKg` при назначении продукта = `getCellCapacity(cell) * 0.7`.
- На сиропных карточках — необязательное поле **Bottle size, L** (`max_amount_kg`), placeholder `3`,
  шаг 0.1, min 0.1; пустое = дефолт. Максимум ползунка/инпута остатка = `getCellCapacity(cell)`.
  При уменьшении ёмкости ниже текущего остатка — клампить остаток в черновике сразу.
- `ContainersPreview` (визуальные банки с уровнем): рисовать и сиропные слоты (можно другой
  иконкой/цветом), уровень = `amount / getCellCapacity`, подпись в `L`. Проп `containerCount` там
  тоже заменить на список слотов.
- Тело PUT `assignments[]`: `{ cellId, position, productId, isActive, amountKg, maxAmountKg }` —
  без `cellCategory`.
- Подсказка в шапке: «Click and hold a container level to edit it. Powder is in kg, syrup in litres.»

### 6. Линии и продукты

- Форма линии (создание/редактирование клиентской линии): селект **Type: Powder / Syrup
  (concentrate)** → `product_type`. Для линий, клонированных из корневых, Strapi уже копирует
  `product_type` из базовой линии.
- `components/portal/product-lines/new-product/index.tsx` (строки ~330/344, 712/724): дефолт
  `product_type` и `serving_unit` для нового продукта брать из `productLine.product_type`
  (concentrate → `concentrate` + `ml`), поля остаются редактируемыми.
  `pages/api/portal/product-lines/[id]/products.ts` (строки ~545/548 — хардкод `powder`/`g`):
  если тип не прислан — не слать вовсе (lifecycle Strapi подставит из линии), либо слать из линии.

### 7. Остальное, что знает про `container_count`

`PowdersDialogContent.tsx`, `MachineConsumptionSection.tsx`, `lib/portal/machineHealth.ts`,
`pages/admin/presets.tsx`, `pages/api/admin/presets/*` — пройти grep по `container_count`,
`getMachineContainerCount`, `cellCategory`: везде, где перечисляются слоты машины, использовать
общее число слотов и категорию по позиции; где считается «порошок кончается» — для сиропных слотов
показывать литры. Presets: `preset-cell.cell_category` оставить как есть (пресет не знает модель),
но при применении на машину категория всё равно выведется из позиции на сервере.

## Проверка

1. Машина 118 (bob): страница ассортимента показывает 4 порошковых + 3 сиропных слота; в 5/6/7 —
   Mojito 0.985 L (bottle 1), Grapefruit 0.7 L (bottle 0.7), Pineapple 2.5 L (bottle пусто = 3).
2. Изменить bottle у позиции 6 на 1.2 и остаток на 1.0 → PUT проходит, `GET /api/machines/002/planogram`
   (с токеном машины) отдаёт `cells[5].maxVolume = 1200`, `cellCategory.name = "Концентрат"`.
3. Попытка поставить порошок (например Chocolate Hazelnut 1493) в позицию 6 → понятная ошибка
   из Strapi, форма не ломается.
4. Создать продукт в линии Isotonic без выбора типа → в Strapi он `concentrate` / `ml`.
5. Touch-машина (например 159 swan, `shaker touch`): 8 + 6 слотов, позиции 9–14 сиропные.
6. `npm test` (vitest) — новые тесты на `containerSlots` зелёные; `npm run build` без ошибок.

## Чего не делать

- Не слать `cell_category` с клиента как источник истины и не давать пользователю её менять.
- Не переставлять `position` (например «сироп 1» ≠ позиция 1; у Shaker S первый сироп — позиция 5).
- Не трогать Strapi: схемы, lifecycles и планограмма уже в проде (`strapi/src/utils/container-capacity.js`,
  `machine-cell/lifecycles.js`, `machine/controllers/machine.js`, коммит cd76703).

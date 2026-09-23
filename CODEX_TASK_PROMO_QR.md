# Codex: QR-код промокода (поделиться → показать машине → скидка сама)

23.09.2026. Киоск уже умеет (патч 73, стоит на тестовой машине cow). Strapi не меняется.
Нужен только фронт: **QR у каждого промокода на `/promos`** + **публичная страница `/p/[code]`**.

## Зачем

Сейчас промокод покупатель вводит руками на экране оплаты. Клиент (владелец точки) хочет раздавать
промокод картинкой/ссылкой: в соцсетях, на флаере, в чате. Покупатель подносит QR к сканеру машины —
и скидка применяется сама.

## Что делает машина (менять не надо, только чтобы понимать)

Сканер машины принимает промокод в любом из видов (регистр не важен):

```
https://<любой хост>/p/<CODE>          ← это и кладём в QR
https://<любой хост>/promo/<CODE>
https://<любой хост>/...?promo=<CODE>
PROMO:<CODE>
<CODE>                                 ← «голый» код, только если ≤ 12 букв/цифр (старый путь)
```

`<CODE>` = `[A-Za-z0-9_-]{1,32}`. Код с другими символами (пробел, точка, кириллица, `#`…) машина
из QR **не примет**.

Скан на любом экране (главный, выбор вкуса, объём) запоминается и применяется, как только покупатель
дошёл до оплаты (скидке нужен выбранный вкус). Сброс — возврат на главный экран или 5 минут.
Проверка и списание — существующие `GET /api/machines/:serial/promo/:code` и `promo-redeem` в Strapi.

## 1. Хелпер `lib/portal/promoQr.ts` (+ `promoQr.test.ts`)

```ts
export const PROMO_QR_CODE_RE = /^[A-Z0-9_-]{1,32}$/;
export const isQrSafePromoCode = (code: string) => PROMO_QR_CODE_RE.test(code.trim().toUpperCase());
export const buildPromoQrUrl = (code: string, origin = PUBLIC_SITE_ORIGIN) =>
  `${origin.replace(/\/+$/, "")}/p/${encodeURIComponent(code.trim().toUpperCase())}`;
```

`PUBLIC_SITE_ORIGIN` = `process.env.NEXT_PUBLIC_SITE_URL || "https://ishakeradmin.com"`.
**Не** `window.location.origin`: QR, сделанный с localhost или превью-домена, в проде станет мёртвой
ссылкой (машине хост безразличен, а вот телефону покупателя — нет).

Тесты (в стиле `promoScope.test.ts`): апперкейс, trim, `SUMMER-25` ок, `A B`/`Ä1`/33 символа — не ок,
URL собирается без двойного слэша.

## 2. Страница `/promos` — кнопка «QR» на карточке промокода

- Рядом с плашкой кода (`Box3D` с `{promo.code}`) — кнопка/иконка QR (`react-qr-code` уже в зависимостях,
  пример использования — `components/portal/machines/MachineDoorUnlock.tsx`).
- Модалка: QR (`value = buildPromoQrUrl(code)`, `level="M"`, ≥ 256 px, **белый фон с полем ≥ 16 px**
  вокруг — сканер машины на тёмной теме не читает), под ним код крупно, ссылка, название и скидка
  (`20% off` / `$2.00 off`), срок действия.
- Действия: **Download PNG** (SVG → canvas → png, имя `promo-<CODE>.png`, 1024 px, белый фон),
  **Copy link**, **Share** (`navigator.share({ url })`, только если есть), **Print** (необязательно).
- Кнопка недоступна для `cancelled` / `expired` / истёкших по `end_at` (как бейджи на карточке сейчас).
- Если `!isQrSafePromoCode(code)` — кнопка disabled + подсказка «This code has characters the machine
  scanner can't read — create a new code with letters, digits, - or _».

## 3. Форма создания промокода

- Валидация поля `code` тем же `PROMO_QR_CODE_RE` (после `toUpperCase`), понятная ошибка под полем;
  в поле подсказка «letters, digits, - and _, up to 32».
- То же правило в BFF `pages/api/portal/promos/index.ts` (POST) → `400 { error: "invalid_code" }`.
  Старые коды в Strapi не трогать.

## 4. Публичная страница `pages/p/[code].tsx`

То, что откроет **телефон покупателя**, если он отсканирует QR камерой (или получит ссылку в чате).
Главная идея: с этой страницы покупатель **показывает QR с экрана телефона** сканеру машины.

- Без логина, без запроса в Strapi (не раскрываем скидку/сроки/клиента посторонним и не даём
  перебирать коды). `getServerSideProps` или статически: только нормализация кода;
  невалидный по `PROMO_QR_CODE_RE` → 404.
- Разметка в стиле `pages/qr/index.tsx` (Header, тёмный фон), но сам QR — на белой карточке с полем:
  QR того же URL (`buildPromoQrUrl(code)`), под ним код крупно (можно скопировать), текст:
  «Show this QR code to the scanner on the iShaker machine. Your discount is applied at checkout.»
  и мелко «Or enter the code on the payment screen.»
- Подсказка «Turn up your screen brightness» — сканеры плохо читают тусклый экран.
- `NextSeo` с `noindex, nofollow`.
- Страница должна открываться без куки портала: проверь, что middleware/guard портала `/p/*` не
  заворачивает на логин.

## Не делать

- Не менять Strapi, схему `promo-code` и эндпоинты.
- Не показывать на `/p/[code]` скидку, срок, машину, клиента.
- Не пушить: коммит в `main` локально, пуш сделает пользователь.

## Проверка

- `npm test` (или как гоняются `*.test.ts` в репо) + `npm run lint` + `npm run build`.
- Вручную: `/promos` → QR → Download PNG открывается, телефонная камера читает ссылку,
  `/p/SUMMER25` открывается без логина, `/p/bad code` → 404.

---
change_id: refactor-opportunities
title: Rank documented tech debt into refactor opportunities + plan one safe change
status: impl_reviewed
created: 2026-06-25
updated: 2026-06-25
archived_at: null
---

## Notes

Intencja: mamy analizę tego repozytorium, która dokumentuje dług techniczny i ryzyka strukturalne: context/changes/password-reset-data-flow/research.md. Ta zmiana odpowiada na pytanie, które tamta analiza celowo zostawiła otwarte: KTÓRE z tych problemów warto naprawić, w jakim docelowym kształcie i w jakiej kolejności. Eksplorujemy każdy zapisany problem w kodzie i historii, a potem porządkujemy je jako refactor opportunities. Zmiana przebiega etapami: eksploracja → decyzja i plan → implementacja. Na etapie eksploracji nie dzieje się żaden refaktor i nie zapada żadna decyzja. Wynik eksploracji: research.md tej zmiany, zakończony rankingiem opcji z trade-offami. Najpierw przeczytam raport; decyzja, co realizujemy, zapada na etapie planowania, a refaktor rusza dopiero według przyjętego planu.

Decyzja planowania (2026-06-25): realizujemy C1 (pojedyncze źródło prawdy dla MIN_PASSWORD_LENGTH) + wpięcie `npm test` do CI. Zakres C1 = 3 stałe TS + guard dryfu config.toml. Trzy fazy green-then-enforce. Poza zakresem: C2, testy D1/D5, D6, mechanizm token_hash, parametryzacja stringów i18n, serwerowy floor w signup.ts.

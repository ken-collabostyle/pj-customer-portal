---
type: task-record
date: 2026-09-28
status: open
tags: [顧客ポータル, 年額契約変更, kintone連携, フェーズ4]
related:
  - docs/plans/2026-09-28_フェーズ4ステップa_年額版インスタンス名UIとkintone連携.md
  - docs/agent-records/2026-09-02_フェーズ1ステップa_インスタンス名UIとkintone連携_実装.md
resolves: []
---

# フェーズ4 ステップa 年額版インスタンス名UI＋kintone連携

- 日付: 2026-09-28
- 担当: 波多野（開発窓口） / Claude Code

## 背景・目的

[フェーズ4計画](../plans/2026-09-25_フェーズ4_年額契約変更カスタマイズ計画.md)フェーズ1のステップa。年額版フォームに、月額版ステップaと同じパターン（インスタンス名の代替プルダウンUI＋kintone-contract-dbからの現在契約情報取得・表示）を実装し、年額のみ新規の「契約期限」もあわせてセットする。

## 調査内容（Reasoning）

年額版[実装メモ](../forms/requirements/【クラウド版】注文書兼利用申込書（年額：契約変更）_実装メモ.md)・[パーツID設計](../forms/requirements/【クラウド版】注文書兼利用申込書（年額：契約変更）_パーツID設計.md)・実フォームJSONを確認し、単一項目・明細テーブル列とも月額版とパーツIDが一致することを確認した。[クラウド契約管理DB.md](../kintone/クラウド契約管理DB.md)の記載（2026-08-25ユーザー確認済み）から、年額の単価は`単価_月額_税抜`ではなく`契約金額`フィールドを使う点、`契約終了日`（DATE型）が契約期限のデータソースである点を確認した。[詳細計画](../plans/2026-09-28_フェーズ4ステップa_年額版インスタンス名UIとkintone連携.md)としてユーザー承認を得た。

## 実施内容（Acting）

1. `src/forms/annual-contract-change-logic.ts`を新規作成。月額版`monthly-contract-change-logic.ts`と同じ構造で、`ContractRecord`に`contractExpiry`を追加し、`CONTRACT_DB_FIELD_CODES.unitPrice`を`契約金額`、`contractExpiry`を`契約終了日`に設定。`isActiveAnnualRecord`（月額年額=年額 かつ 契約ステータス2=契約中）・`filterActiveAnnualRecords`・`extractUniqueInstances`・`filterRecordsByInstance`・`findBaseRecord`（`BASE_CATEGORY`は`contract-change-shared-logic`からimport）・`buildCurrentContractSummary`（`contractExpiry`含む）・`buildLineItems`（「nヶ月分」商品の読み替えは行わずそのまま表示）を実装
2. `src/forms/annual-contract-change.ts`を新規作成。月額版`monthly-contract-change.ts`のステップa相当部分（インスタンス選択プルダウンのDOM操作、ローディング表示、各種フェイルセーフ）を同じパターンで複製し、`applyInstanceData`で契約期限（`fidCurrentContractExpiry`）もセットするよう拡張
3. `scripts/build.mjs`の`forms`配列に`annual-contract-change`を追加
4. `tests/forms/annual-contract-change-logic.test.ts`を新規作成し、1のユニットテストを追加（16件）

## 結果・観察（Observation）

`npm run lint` / `npm run typecheck` / `npm test`（58件、月額42件＋年額16件）/ `npm run build`（`dist/forms/annual-contract-change.js`生成）をすべて実行し通過を確認した。

## 得られた知見・製品への示唆

月額版で確立したDOM操作パターン（プルダウン代替UI・ローディング表示・フェイルセーフ）は年額版にもそのまま適用でき、実装の見通しが良かった。一方、DOM操作関連の関数は月額・年額で完全に同一のコードを複製しており、将来的にフォームが増えた場合は`contract-change-shared-logic.ts`とは別に、DOM操作用の共通モジュール化を検討する余地がある（今回はフェーズ4計画のアーキテクチャ方針のスコープ外のため見送り）。

## 未解決課題・申し送り事項

- ユーザーによる検証環境での実機確認が未実施。契約期限（`fidCurrentContractExpiry`、date型パーツ）へのkintone DATE型値（`YYYY-MM-DD`想定）のセットが問題なく表示されるか、複数インスタンス切り替え・明細表示・フェイルセーフ動作とあわせて確認が必要
- 実機確認完了後、[計画ファイル](../plans/2026-09-28_フェーズ4ステップa_年額版インスタンス名UIとkintone連携.md)のstatusをcompletedに更新し、本記録のstatusもresolvedにする

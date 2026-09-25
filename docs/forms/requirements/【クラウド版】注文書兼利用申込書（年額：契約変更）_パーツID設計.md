# パーツID設計：【クラウド版】注文書兼利用申込書（年額：契約変更）

月額版フォーム（[【クラウド版】注文書兼利用申込書（月額：契約変更）.json](../json/【クラウド版】注文書兼利用申込書（月額：契約変更）.json)）の既存パーツIDと突き合わせ、意味的に同一の項目は同じ命名に揃えた。年額版のみに存在する項目には新規IDを採番している。

参照元：[【クラウド版】注文書兼利用申込書（年額：契約変更）.xlsx](../【クラウド版】注文書兼利用申込書（年額：契約変更）.xlsx)

## 単一項目

| 表示ラベル | 月額と同一意味か | 提案ID |
|---|---|---|
| ＊規約への同意（コラボフロー） | 同一 | `fidCollaboflowTermsAgreement` |
| ＊法人／団体名 | 同一 | `fidCorporateName` |
| ご契約中のインスタンス名 | 同一 | `fidContractedInstanceName` |
| 現在契約プラン | 同一 | `fidCurrentContractPlan` |
| 現在契約ユーザー数 | 同一 | `fidCurrentContractUserCount` |
| 契約期限（日付型） | 年額のみ新規 | `fidCurrentContractExpiry` |
| 変更適用希望年 | 同一 | `fidChangeApplyYear` |
| 変更適用希望月 | 同一 | `fidChangeApplyMonth` |
| 変更適用月差分（"ヶ月分"） | 年額のみ新規 | `fidChangeApplyMonthDiff` |
| お試し環境のURL | 同一 | `fidTrialEnvUrl` |
| テスト環境のURL希望① | 同一 | `fidTestEnvUrlFirstChoice` |
| テスト環境のURL希望② | 同一 | `fidTestEnvUrlSecondChoice` |
| テスト環境のURL希望③ | 同一 | `fidTestEnvUrlThirdChoice` |
| サブドメイン（コラボフォーム申込み時） | 同一 | `fidCollaboformSubdomain` |
| 規約への同意（コラボフォーム契約時） | 同一 | `fidCollaboformTermsOnContract` |
| 規約への同意（コラボフォーム解約時） | 同一 | `fidCollaboformTermsOnCancel` |
| コラボフォーム現在サブドメイン（解約時） | 同一 | `fidCollaboformCurrentSubdomain` |
| ご注文小計 | 同一 | `fidOrderSubtotal` |
| ご注文消費税 | 同一 | `fidOrderTax` |
| ご注文合計金額 | 同一 | `fidOrderTotalAmount` |

## 明細テーブル1（１．変更後契約数入力欄・既存商品）

月額版と同じ7列構成（内容／商品コード／単価／現契約数／⇒／変更後契約数／価格）。

| 列 | 月額と同一意味か | 提案ID |
|---|---|---|
| 商品解約（チェックボックス） | 同一 | `fidProductCancel` |
| 変更後商品名 | 同一 | `fidChangedProductName` |
| 変更後商品コード | 同一 | `fidChangedProductCode` |
| 変更後商品単価 | 同一 | `fidChangedProductUnitPrice` |
| 現商品契約数 | 同一 | `fidCurrentProductQuantity` |
| 変更後商品契約数 | 同一 | `fidChangedProductQuantity` |
| 変更後差分契約数（自動計算：変更後商品契約数－現商品契約数） | 年額のみ新規 | `fidChangedProductQuantityDiff` |
| 変更後商品価格 | 同一 | `fidChangedProductPrice` |

## 明細テーブル2（２．オプション等の新規追加欄）

月額版と同じ7列構成。

| 列 | 月額と同一意味か | 提案ID |
|---|---|---|
| 追加商品名 | 同一 | `fidAddedProductName` |
| 追加商品コード | 同一 | `fidAddedProductCode` |
| 追加商品単価 | 同一 | `fidAddedProductUnitPrice` |
| 追加商品契約数 | 同一 | `fidAddedProductQuantity` |
| 追加商品価格 | 同一 | `fidAddedProductPrice` |
| 追加商品区分 | 同一 | `fidAddedProductCategory` |

## 検討経緯

* Excelテンプレート初版では、テーブル1・2の両方に単価×数量＝価格を意図した「数量」列（`変更後商品数量`／`追加後商品数量`）が存在した。**2026-09-25、業務支援チームとの調整の結果、「追加後商品数量」（旧`fid20`）は不要として削除、「変更後商品数量」（旧`fid15`）は「変更後差分契約数」として残す方針に確定**。`fidChangedProductQuantityDiff`という新規IDで、`type: calculate`（formula: `fidChangedProductQuantity-fidCurrentProductQuantity`、変更後契約数－現契約数）に変更済み。パーツ名（`name`）も「変更後差分契約数」に更新済み（2026-09-25、詳細は[実装メモ](【クラウド版】注文書兼利用申込書（年額：契約変更）_実装メモ.md)参照）。なお本パーツは月額版フォームにも後日追加予定（ToDo）。
* 「契約期限」は年額版のみの新規項目で、日付型として保持する。
* 上記2点以外は月額版と同一の意味を持つため、既存パーツIDをそのまま踏襲した。

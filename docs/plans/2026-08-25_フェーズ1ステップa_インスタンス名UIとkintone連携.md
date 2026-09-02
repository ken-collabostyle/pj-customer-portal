---
type: plan
date: 2026-08-25
status: in-progress
tags: [顧客ポータル, 月額契約変更, kintone連携, フェーズ1]
related:
  - docs/plans/2026-08-24_顧客ポータルカスタマイズ全体計画.md
  - docs/forms/requirements/【クラウド版】注文書兼利用申込書（月額：契約変更）.md
  - docs/forms/requirements/【クラウド版】注文書兼利用申込書（月額：契約変更）_実装メモ.md
  - docs/kintone/README.md
---

# フェーズ1 ステップa 詳細計画：インスタンス名UI＋kintoneから現在契約情報を取得・表示

[全体計画](2026-08-24_顧客ポータルカスタマイズ全体計画.md)フェーズ1のステップa。CLAUDE.md「1. 推論」の承認ゲートルールに基づき、実装着手前に本計画をユーザーの承認を得てから着手する。

## 承認状況

**承認済み**（2026-09-02、DOM構造不一致時のフェイルセーフ追記版を含めて承認）

## 実装するファイル（新規）

- `src/forms/monthly-contract-change.ts` — このフォーム専用のカスタマイズソース。フェーズ1の各ステップ（a, b, c, e, f）はこの1ファイルに順次イベントハンドラーを追加していく想定（コラボフォームへは1つの.jsファイルをアップロードする運用のため）
- コンパイル成果物 `dist/forms/monthly-contract-change.js` は`.gitignore`対象（既存の`dist/`除外ルールを踏襲）。ビルド後、ユーザーがコラボフォーム管理画面に手動アップロードする

## 実装内容

1. `form.show`イベントで`collaboform.proxy.call('kintone-contract-db')`を呼び出す（顧客番号はプロキシ側の固定値を使うためJSからは渡さない。詳細は[docs/kintone/README.md](../kintone/README.md)参照）
2. 取得したレコード群から、`区分`="ベース"の行を現在契約プランとして特定し、`fidCorporateName`（法人名）・`fidCurrentContractPlan`（現在契約プラン）・`fidCurrentContractUserCount`（現在契約ユーザー数）にセット
3. 取得レコードから`インスタンス`の値をユニーク抽出
   - **1件のみの場合**：そのまま`fidContractedInstanceName`（テキストパーツ）にセット（`parts`オブジェクト経由、公式APIでサポート済み）
   - **複数件の場合**：プルダウンでのUIを実装する（2026-08-25、DOM構造確認により実現可能と判明。下記参照）
4. プルダウン選択時（初期表示・選択変更いずれも）、選択中のインスタンス名でローカルにキャッシュ済みのkintone取得結果を再フィルタし、`fidCorporateName`・`fidCurrentContractPlan`・`fidCurrentContractUserCount`・明細テーブル（`fidChangedProduct*`等）を再セットする（インスタンス切り替え時にkintoneへの再リクエストは行わない）

### 複数インスタンス時のプルダウンUI実装方式（2026-08-25 DOM構造確認済み）

ユーザーが共有したDOM構造により、`fidContractedInstanceName`のネイティブ`<input>`要素は`id="fidContractedInstanceName"`（パーツIDと一致）で確実に取得できることを確認。

```html
<div class="mantine-Input-wrapper ...">
  <input id="fidContractedInstanceName" type="text" ...>
</div>
```

方式：
1. `document.getElementById('fidContractedInstanceName')`でネイティブinput要素を取得
2. インスタンス名が複数ある場合、`input.style.display = 'none'`でネイティブinputを非表示にし、同じ`.mantine-Input-wrapper`内に`<select>`要素を挿入（ラベル等の周辺UIはそのまま維持）
3. `<select>`の`change`イベントで、選択値を`parts['fidContractedInstanceName'].value`にセット（公式API経由でネイティブinputの値も同期される）し、上記4.の再フィルタ処理を実行
4. 単一インスタンスの場合はプルダウンを表示せず、ネイティブinputへの直接セットのみ行う

**リスク**：この方式はコラボフォームJS APIの公式サポート対象外（DOM構造への直接依存）。コラボフォームのUIライブラリ（Mantine）がバージョンアップ等でDOM構造・クラス名を変更した場合、動作しなくなる可能性がある。要求事項の実現に必要な措置として実施するが、この制約をコード上にコメントで明記し、実施記録にも残す。

### DOM構造不一致時のフェイルセーフ（2026-09-02追加）

上記リスクが顕在化した場合（`document.getElementById('fidContractedInstanceName')`が取得できない、または想定する`.mantine-Input-wrapper`親要素が見つからない等）に、ユーザーが誤った状態のまま申請してしまうことを防ぐため、以下を実装する。

1. **検知**：プルダウンUI構築処理（複数インスタンス時のみ）内でネイティブinput要素・親wrapper要素の取得結果をnullチェックする。取得できない場合はDOM構造不一致と判定し、モジュール内フラグ（例：`instanceSelectorInitFailed`）を`true`にする。単一インスタンスの場合は公式API（`parts`経由）のみで完結するため、本フェイルセーフの対象外（DOM依存なし＝失敗しない）。
2. **可視化**：検知した時点（`form.show`内）で`console.error`に原因を出力するとともに、`alert()`でユーザーに「契約インスタンスの選択UIが正しく表示できませんでした。システム管理者にお問い合わせください（申請は行えません）」等、原因と対処が分かるメッセージを表示する。
3. **申請の禁止**：`form.confirm`イベントハンドラーで`instanceSelectorInitFailed`が`true`の場合、再度エラーメッセージを`alert()`表示した上で`false`をreturnし、入力内容確認画面への遷移を中止する（[events-reference.md](../collaboform-js-api/events-reference.md)参照）。`form.confirm`は公式サポートのイベントであり、DOM構造に依存しないため、このフェイルセーフ自体はUIライブラリのバージョンアップの影響を受けない。念のため`form.submit`でも同様のチェックを行い、二重に申請をブロックする。

## 実装するファイル（新規）に対する補足

上記フェイルセーフのフラグ（`instanceSelectorInitFailed`等）は、フェーズ1の他ステップ（b以降）が同一ファイル内に追記されていくことを踏まえ、ファイル内で一意に分かる名前とし、他の申請ブロック条件（bの解約チェック連動等）と混在しないようコメントで区別する。

## 今回やらないこと（切り出し）

- b（解約チェック連動）以降は次のステップとして別途計画する

## 影響範囲

- 新規ファイルのみ追加。他フォーム・既存パーツへの影響なし
- DOM構造に依存する非公式な実装のため、コラボフォーム側のUI変更で動作しなくなるリスクがある（上記参照）

## 確認方法

1. Claudeが`npm run lint` / `npm run typecheck` / `npm run test`を実行
2. `npm run build`（未整備のため追加が必要）でdist生成
3. ユーザーが検証環境にアップロードし、ブラウザコンソールで`console.log`出力とフォーム上の値反映を確認、結果を共有
4. フェイルセーフの動作確認：ローカル環境で一時的に取得対象のID/クラス名を意図的に変更するなどしてDOM構造不一致を疑似的に発生させ、`alert()`表示と「確認」ボタン押下時の遷移中止（および「送信」ボタン押下時の中止）を確認する

## 前提・依存事項

- `kintone-contract-db`エンドポイントのquery固定値（テスト用顧客番号）がまだ設定されていない（[全体計画](2026-08-24_顧客ポータルカスタマイズ全体計画.md)参照）。実装自体は着手可能だが、実機での動作確認はこの設定完了後になる

## 実装状況（2026-09-02）

コード実装が完了。`npm run lint` / `npm run typecheck` / `npm run test`はすべて通過、`npm run build`でdist生成も確認済み。詳細は[実施記録](../agent-records/2026-09-02_フェーズ1ステップa_インスタンス名UIとkintone連携_実装.md)を参照。**実機（検証環境）での動作確認は未実施**（テスト用顧客番号未設定のため、上記前提が解消され次第ユーザーが実施）。

実装中に判明した以下の点は、`docs/kintone/クラウド契約管理DB.md`の生JSON突合（[docs/kintone/json/クラウド契約管理DB_getFormFields.json](../kintone/json/クラウド契約管理DB_getFormFields.json)）を経て、ユーザーに個別確認のうえ決定した。

- 「現在契約中のレコード」の判定条件：`区分`="ベース" **かつ** `月額年額`="月額" **かつ** `契約ステータス2`="契約中"（当初計画は`区分`="ベース"のみだったが、`月額年額`・`契約ステータス2`が新たに使えることが判明したため拡張）
- 明細テーブルの「変更後商品名」（`fidChangedProductName`）には、クラウド契約管理DBに「商品名」専用フィールドが存在しないため、代替として`サービス名_請求書用`を使用
- 明細テーブルの「変更後商品単位」（`fidChangedProductUnit`）に対応するkintoneフィールドが見つからなかったため、**今回は未設定のまま**（空欄）とした。次のステップ着手時までにデータソースを要確認（[実施記録](../agent-records/2026-09-02_フェーズ1ステップa_インスタンス名UIとkintone連携_実装.md)の「未解決課題」参照）

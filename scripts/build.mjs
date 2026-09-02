// コラボフォームへアップロードする単一のJSファイルを生成するビルドスクリプト。
// コラボフォームのカスタマイズJSはimport/exportのないプレーンなスクリプトとしてアップロードする運用のため、
// esbuildでバンドルしIIFE形式1ファイルに出力する。
import { build } from "esbuild";

const forms = ["monthly-contract-change"];

await Promise.all(
  forms.map((form) =>
    build({
      entryPoints: [`src/forms/${form}.ts`],
      outfile: `dist/forms/${form}.js`,
      bundle: true,
      format: "iife",
      target: "es2020",
      banner: { js: "'use strict';" },
    })
  )
);

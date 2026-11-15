# 開発ガイド

[AppDock共通指示](../AppDock.at365/AGENTS.md)、[Applet API](../AppDock.at365/docs/extensions.md)、[読み上げ設計](../AppDock.at365/docs/speech-applet-design.md)、[共通固定ランタイム](../AppDock.at365/docs/test-runtime.md)を正本とする。

外部依存のないNode CommonJS Applet。`src/processing.cjs`がCSV・辞書・分割、`index.cjs`が宣言型設定の補助操作とMCP handlerを所有する。`extension.json`が版・最低ホスト版・設定・MCP宣言の正本。

`test.bat`は本体の固定Nodeで`tests/*.test.cjs`を実行する。`publish.bat`はテスト後に明示したファイルだけを`.artifacts/applet`へ配置し、共通pack-applet-update.ps1で更新ZIP/JSONを作る。発行先は共通publish-paths.cjsで解決する。外部公開と実利用先への配置は別操作。

本体との結合試験は本体`scripts/applet-api-ui-test.cjs`を使い、検証結果・入力ハッシュは[VERIFICATION](VERIFICATION.md)へ記録する。実サーバー品質と物理出力はfixtureによる受付・プレイヤー完了と区別する。

# 検証記録

## 2026-11-15 Speakの表示名と紹介文

- displayNameを`Speak`、taglineを`AIの言葉に、声を。`へ設定。概要とMCP表示タイトル/モジュール説明、利用ガイドを更新した。Applet ID・モジュールID・公開ツール名/Schema・通常設定・配置先・リポジトリ名は維持する。公開API/設定の追加変更を伴わない表示更新として0.1.1へパッチ更新した。
- 発行前に表示メタデータと影響範囲をレビューし、指摘なし。既存9件が成功し、共通publishでローカル発行した。update.json/manifestの版、名前・紹介文、ZIP全3項目とrepo/発行物のSHA-256を照合した。証跡は`.artifacts/speak-branding-20261115/`。
- 発行済み本Applet・固定AppDock 0.246.0・隔離Relay fixtureによる既存結合11群も成功。本体試験の画面選択はmanifestの表示名を参照する形へ更新した。本体の製品コード/版は変更せず、実利用先への配置は行っていない。
- update.zip SHA-256: `3de5dd3d42bc1bb22893e4cf36fdcd422a9470b11d52ba44819f0b3e5035d703`。manifest SHA-256: `689bf6bbaf7b238ce53723c6aa028e327fe61a7904d96308638e3df023e25d79`。index/processingの内容ハッシュは0.1.0と同じ。

## 2026-11-15 初回実装

- 個人CSV・最長一致の非再帰置換・Unicode/英単語境界・自然な文章分割・設定・宣言型補助画面・MCP受付handlerを実装。
- 固定Node 26.13.1による単体試験9件が成功。UTF-8/BOM/改行/引用符の往復、レコード位置の入力拒否、置換境界、グラフェム/URL/長語/置換語、12,000語の辞書と長文、排他的開始方式、プレビュー無通信、プレビュー後の原子的取り込み/競合を検査。証跡は`.artifacts/tests.log`。
- 本体0.246.0のreadManifestで宣言を読み込み、1モジュール/1ツールを検証。本体側の共通設定53件、型検査、main buildも成功した。
- 固定本体・実Applet・Relayの結合結果と発行ハッシュは以下に記録する。実サーバーと物理音声は未検証。

## 2026-11-15 発行と固定配布物の確認

- 0.1.0、minimumHostVersion 0.246.0を共通ヘルパーでローカル発行。製品入力コミット`73404e4`。publish内の単体9件、更新packの終了コード、manifest・update.json・ZIPの版/容量/SHA-256、全3項目とrepo原本を照合した。
- AppDock 0.246.0固定EXE、発行済み本Applet、Relay 0.3.0による11群が成功。共有スイッチと通常リセットの独立、CSV取り込み/編集OK/入力Esc復元と取消、無通信プレビュー、小数秒、明暗/1280・760幅、4入力と即時受付、OFF/切断/Applet無効化後の継続、3部分の順序/count=2/生成再生の重なり、再起動保存を確認。
- 一般/Codexの両入口と実Node/.NET/nativeのMCP提供、2ツールを1スイッチで制御、禁止API拒否/停止/再起動も同じ固定本体で確認。証跡は本体`.artifacts/speech-applet-20261115/phase6-fixed-providers.log`、profile=`applet-api-portable-1794744124957`、全体の[検証記録](../AppDock.at365/VERIFICATION.md)。専用fixture EXE/Runtimeを回収済み。

| 内容 | SHA-256 |
| --- | --- |
| extension.json | `fbc7c28f67ca28c7cff7ac6eb8c772c579eb4537e2f5415494fd439d29e8c9b5` |
| index.cjs | `eb3c853052f8fe990459a727f762c821fcbf250df25f3eb3bb57aa9633ffdf57` |
| src/processing.cjs | `be7707f745daf0e799f8c4793ba567dc705ef97153965d580183f6cf165d210a` |
| update.zip | `1be0156aa2d441c011514c6bc607092c17774745c1c048d1eb26b9ae5594e2d1` |

実サーバーの品質・物理音声と配布辞書は未確認。スターター/カタログ/実利用先へ追加せず、push/外部公開も行っていない。

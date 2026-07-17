/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'プロジェクト全体で循環参照を禁止します。',
      from: {},
      to: { circular: true }
    },
    {
      name: 'feature-isolation',
      severity: 'error',
      comment: '機能間 (features/x と features/y) の直接参照を禁止します。連携は main.ts を介してください。',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/',
        pathNot: '^src/features/$1/'
      }
    },
    {
      name: 'logic-renderer-separation',
      severity: 'error',
      comment: '同一機能内であっても logic と renderer の直接参照を禁止します。',
      from: { path: '^src/(features|shared)/([^/]+)/logic\\.ts$' },
      to: { path: '^src/(features|shared)/$2/renderer\\.ts$' }
    },
    {
      name: 'renderer-logic-separation',
      severity: 'error',
      comment: '同一機能内であっても renderer と logic の直接参照を禁止します。',
      from: { path: '^src/(features|shared)/([^/]+)/renderer\\.ts$' },
      to: { path: '^src/(features|shared)/$2/logic\\.ts$' }
    },
    {
      name: 'renderer-store-separation',
      severity: 'error',
      comment: 'Renderer は Store を直接参照してはなりません。状態は main.ts から引数として受け取ってください。',
      from: { path: '^src/(features|shared)/([^/]+)/renderer\\.ts$' },
      to: { path: '^src/core/store/' }
    },
    {
      name: 'core-protection',
      severity: 'error',
      comment: 'Coreレイヤーが上位のFeaturesレイヤーに依存することを禁止します。',
      from: { path: '^src/core/' },
      to: { path: '^src/features/' }
    },
    {
      name: 'engine-purity',
      severity: 'error',
      comment: 'Engine (計算機) は types 以外に依存してはなりません。',
      from: { path: '^src/core/engine/' },
      to: {
        path: '^src/',
        pathNot: ['^src/types\\.ts$', '^src/core/engine/']
      }
    },
    {
      name: 'ui-purity',
      severity: 'error',
      comment: 'ui.ts (Presentation) は types, shared/utils/ui (および自分自身) 以外に依存してはなりません。',
      from: { path: '^src/(features|shared)/([^/]+)/ui\\.ts$' },
      to: {
        path: '^src/',
        pathNot: ['^src/types\\.ts$', '^src/shared/utils/ui/', '^src/(features|shared)/$2/ui\\.ts$']
      }
    },
    {
      name: 'ui-access-restriction',
      severity: 'error',
      comment: 'ui.ts は同一機能内の renderer.ts からのみ参照可能です。',
      from: {
        path: '^src/',
        pathNot: ['^src/(features|shared)/([^/]+)/renderer\\.ts$', '^src/(features|shared)/$2/ui\\.ts$', '\\.test\\.ts$']
      },
      to: { path: '^src/(features|shared)/([^/]+)/ui\\.ts$' }
    },
    {
      name: 'shared-ui-util-purity',
      severity: 'error',
      comment: 'Shared UI Util はプロジェクト内のどのファイル（types を含む）にも依存してはなりません。',
      from: { path: '^src/shared/utils/ui/' },
      to: {
        path: '^src/',
        pathNot: ['^src/shared/utils/ui/']
      }
    },
    {
      name: 'shared-ui-util-access-restriction',
      severity: 'error',
      comment: 'Shared UI Util は各機能の ui.ts からのみ参照可能です。',
      from: {
        path: '^src/',
        pathNot: [
          '^src/(features|shared)/([^/]+)/ui\\.ts$', 
          '^src/shared/utils/ui/', 
          '\\.test\\.ts$'
        ]
      },
      to: { path: '^src/shared/utils/ui/' }
    },
    {
      name: 'shared-dom-util-purity',
      severity: 'error',
      comment: 'Shared DOM Util はプロジェクト内のどのファイル（types を含む）にも依存してはなりません。',
      from: { path: '^src/shared/utils/dom/' },
      to: {
        path: '^src/',
        pathNot: ['^src/shared/utils/dom/']
      }
    },
    {
      name: 'shared-dom-util-access-restriction',
      severity: 'error',
      comment: 'Shared DOM Util は各機能の renderer.ts からのみ参照可能です。',
      from: {
        path: '^src/',
        pathNot: [
          '^src/(features|shared)/([^/]+)/renderer\\.ts$', 
          '^src/shared/utils/dom/', 
          '\\.test\\.ts$'
        ]
      },
      to: { path: '^src/shared/utils/dom/' }
    },
    {
      name: 'types-purity',
      severity: 'error',
      comment: 'Types はプロジェクト内の他のファイルに依存してはなりません。',
      from: { path: '^src/types\\.ts$' },
      to: {
        path: '^src/'
      }
    },
    {
      name: 'el-purity',
      severity: 'error',
      comment: 'el.ts はプロジェクト内の他のファイルに依存してはなりません。',
      from: { path: '^src/core/el\\.ts$' },
      to: { path: '^src/' }
    },
    {
      name: 'el-access-restriction',
      severity: 'error',
      comment: 'el.ts を参照できるのは main.ts と features/*/renderer.ts のみです。',
      from: {
        path: '^src/',
        pathNot: ['^src/main\\.ts$', '^src/main\\.new\\.ts$', '^src/wiring/', '^src/(features|shared)/([^/]+)/renderer\\.ts$', '^src/core/el\\.ts$']
      },
      to: { path: '^src/core/el\\.ts$' }
    },
    {
      name: 'shared-purity',
      severity: 'error',
      comment: 'Shared はドメイン知識 (core/store, features, storage.ts) に依存してはなりません。',
      from: { path: '^src/shared/' },
      to: {
        path: ['^src/core/store/', '^src/features/', '^src/core/storage\\.ts$']
      }
    },
    {
      name: 'storage-access-restriction',
      severity: 'error',
      comment: 'storage.ts を参照できるのは core/store と main.ts のみに制限します。',
      from: {
        path: '^src/',
        pathNot: ['^src/core/store/', '^src/core/logger/', '^src/main\\.ts$', '^src/main\\.new\\.ts$', '^src/wiring/', '^src/core/storage\\.ts$', '\\.test\\.ts$']
      },
      to: { path: '^src/core/storage\\.ts$' }
    },
    {
      name: 'logic-renderer-only-from-main',
      severity: 'error',
      comment: 'features 配下の logic.ts, renderer.ts は main.ts からのみ参照可能です。',
      from: {
        path: '^src/',
        pathNot: ['^src/main\\.ts$', '^src/main\\.new\\.ts$', '^src/wiring/', '\\.test\\.ts$']
      },
      to: { path: '^src/(features|shared)/([^/]+)/(logic|renderer)\\.ts$' }
    },
    {
      name: 'not-to-dev-dep',
      severity: 'error',
      from: {
        path: '^(src)',
        pathNot: '\\.(spec|test)\\.ts$'
      },
      to: { dependencyTypes: ['npm-dev'] }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"]
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+',
        theme: {
          graph: { splines: "true" },
          modules: [
            { criteria: { source: "^src/core" }, attributes: { fillcolor: "#ccccff" } },
            { criteria: { source: "^src/features" }, attributes: { fillcolor: "#ccffcc" } },
            { criteria: { source: "^src/shared" }, attributes: { fillcolor: "#ffffcc" } },
            { criteria: { source: "^src/types" }, attributes: { fillcolor: "#ffcccc" } }
          ]
        }
      }
    }
  }
};

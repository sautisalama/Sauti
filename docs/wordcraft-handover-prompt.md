# Handover prompt for @gamine/wordcraft-react (one document, supersedes Parts 5 to 7)

You are changing `@gamine/wordcraft-react` (installed in the host app at 0.3.5). The host app (Sauti) replaces
several built-in surfaces with its own and today does it with CSS hacks and `disabledCommands`. Make every surface
switchable and customisable, and make comments fully ownable by the host. Everything is opt-in: with no new props the
editor must render exactly as it does today (snapshot test). Changes apply live (no remount, no loss of document,
selection or collaboration). Keep existing class names stable (`wcwb-ask`, `wccm-launch`).

## 1. Comments: one surface, owned by the host (P0)

Problems in 0.3.5 with `comments` on: the selection toolbar's comment button and the ribbon's Comments / Show Comments
run `review.newComment`, which creates an EMPTY comment and opens the engine's side pane, competing with the host
drawer. `disabledCommands` can stop the pane but not `review.newComment`, because the drawer itself uses it.
Cancelling highlight-and-comment leaves an empty comment.

Add `comments: { exclusive: true }` (alias `nativePane: false`). When set:

1. The engine's pane never opens, from any entry point: `review.newComment`, `review.comments`, `view.commentsPane`,
   `Ctrl+Alt+M`, selection toolbar, ribbon, context menu, mobile palette.
2. Every entry point calls `comments.onRequestCompose({ range, quote })`, or, if absent, opens the package's own
   drawer with its composer on the selection. No comment exists until submitted with text; cancel leaves nothing.
3. Package-internal and API calls are never blocked by `disabledCommands`. Add a host API that bypasses command ids:
   `editor.comments.create({ range, text, parentId? })`, `.reply`, `.edit`, `.delete`, `.resolve`, `.reopen`,
   `.list()`, `.focus(id)`, `.onChange(cb)`. The package keeps ownership of anchors and highlights (they follow
   edits, undo/redo, copy/paste).
4. Edit and Delete are icon buttons under the comment text, for the author or a host-granted admin only.
5. The drawer fits any width (no sideways scroll) and is exported as `<CommentsDrawer/>` with `people`, `currentUser`,
   `canResolve`, `emptyState`.

## 2. A switch for every built-in surface (P0)

Add `ui?: WordcraftUi`; each key is `boolean`, default true. `false` removes the surface from the DOM and its
shortcuts and frees its space (no gap, no console errors); its commands are refused unless called via the API.

```ts
interface WordcraftUi {
  titleBar?: boolean;                // confirm false hides everything in the top bar
  ribbon?: boolean | RibbonDisplay;  // accept false = no ribbon and no tab row
  statusBar?: boolean; selectionToolbar?: boolean; contextMenu?: boolean | string[];
  rulers?: boolean; navigationPane?: boolean; zoomControl?: boolean; pageViewSwitcher?: boolean;
  workspaceRow?: boolean | { ask?: boolean; comments?: boolean; checks?: boolean; tools?: boolean; voice?: boolean };
  presence?: boolean; shareButton?: boolean; mobilePalette?: boolean;
  fileMenu?: boolean | FileMenuConfig;   // see section 4
}
```

With titleBar, ribbon and statusBar all false the host gets a "paper only" editor. Provide a headless `editor` API
(`exec(commandId)`, `canExec`, `getState` for bold/italic/heading/alignment/list, `onSelectionChange`) so the host
can build its own toolbar.

## 3. Top bar layout (P0)

The top bar (title bar with quick access such as undo/redo) becomes three host-configurable zones:

```ts
topBar?: TopBarConfig | ((ctx: { permission, user, collaborators }) => TopBarConfig);
interface TopBarConfig {
  left?: TopBarItem[];    // default ['quickAccess']
  center?: TopBarItem[];  // default ['title','saveState']
  right?: TopBarItem[];   // default ['presence','share','user']
  back?: { onClick?(): void; href?: string; label?: string; icon?: ReactNode; confirmIfUnsaved?: boolean };
  quickAccess?: string[]; // 'undo','redo','save','print','find','spelling', '|' separator, or a host item id
  presence?: { max?: number; size?: 'sm'|'md'; follow?: boolean; includeSelf?: boolean; onAvatarClick?(user): void };
  share?: false | { label?: string; icon?: ReactNode; onClick?(): void; render?: () => ReactNode; disabled?: boolean | string };
  user?: { name: string; email?: string; avatarUrl?: string; menu?: MenuItem[] };
}
type TopBarItem = 'back'|'quickAccess'|'title'|'saveState'|'presence'|'share'|'user'|'comments'|'history'
  | { id: string; render: () => ReactNode }
  | { id: string; icon: ReactNode; label: string; onClick(): void; disabled?: boolean };
```

- Array order is screen order; omitted zone = default; `[]` = empty.
- Back button: far left, `aria-label` "Back to documents" by default, keyboard accessible, hidden if no handler/href.
- Collaborators: avatars top right beside Share and the user icon; colour matches the person's cursor; name tooltip;
  click follows that person (scrolls to their cursor); overflow "+N" with a popover list; guests show as "Guest" with a
  generated colour.
- Share: rename, restyle, hide, or disable with a reason shown as a tooltip.
- User: avatar and host-defined menu (profile, sign out, switch account); hidden if absent.
- Narrow widths: title shortens first, then avatars to "+N", then Share to an icon; never wraps or overflows.

## 4. Granular File options (P0)

```ts
interface FileMenuConfig {
  items?: Partial<Record<FileItemId, boolean | { label?: string; hidden?: boolean; disabled?: boolean | string; onClick?(): void }>>;
  order?: FileItemId[];
  sections?: { id: string; title?: string; items: FileItemId[] }[];
  extra?: { id: string; label: string; icon?: ReactNode; onClick(): void }[];  // e.g. "Move to folder"
}
type FileItemId = 'new'|'open'|'save'|'saveAs'|'rename'|'makeCopy'|'share'|'print'|'export'
  |'exportDocx'|'exportPdf'|'exportOdt'|'exportTxt'|'exportHtml'|'exportMd'
  |'versionHistory'|'info'|'properties'|'protect'|'close'|'options'|'language'|'pageSetup';
```

- Every item (including Share, and each export format separately) can be shown, hidden, renamed, disabled with a
  reason string, or replaced by a host action. Share can be on in the top bar and off in File, or the reverse.
- Hiding or disabling an item also refuses its command and shortcut (hiding `print` disables `Ctrl+P`).
- With the Part 2 permission levels: at view and comment levels `save`, `rename`, `saveAs` are hidden by default; the
  host can override each one explicitly. `fileMenu` also accepts the function form of section 3.

## 5. Icons the host can choose (P1)

`icons?: { ask?, comments?, checks?, tools?, voice?: ReactNode }` on `WordcraftEditorProps`, used by `ToolsBar` and
`CommentsButton`; export the default icons for reuse. The host currently redraws Ask and Comments with CSS masks.

## 6. Letterhead check (P2)

0.3.4 says `ai.letterhead` is now read on every render and a person's edits are a separate override. Confirm with a
test that an `ai.letterhead` supplied after mount appears in AI Studio, and that toggling "Accent rule" alone does not
create an empty override that hides it.

## Acceptance

1. Host sets `comments:{exclusive:true}`, `ui:{titleBar:false,ribbon:false,statusBar:false,selectionToolbar:false}`:
   no native pane opens from any entry point in 10 consecutive runs; the host drawer composer opens on the
   selection; cancel leaves no empty comment; submit creates exactly one; reply, edit, resolve and delete work through
   the API; no DOM from a hidden surface remains.
2. Host sets `topBar = { left:['back','quickAccess'], center:['title','saveState'], right:['presence','share','user'] }`:
   back at far left, undo/redo beside it, two live collaborators' avatars then Share then the user icon at top
   right; clicking an avatar follows that person; at 360px width nothing overflows.
3. Host hides `exportDocx`, disables `share` with a reason, adds "Move to folder": the File menu shows exactly that;
   `Ctrl+P` works when `print` is on and does nothing when off.
4. No new props means an unchanged render (snapshot); each switch has a changelog entry, exported types, and a README
   section "Owning the UI".

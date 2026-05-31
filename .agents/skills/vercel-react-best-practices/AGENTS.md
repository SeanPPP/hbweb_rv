# React Best Practices

**Version 1.0.0**  
Vercel Engineering  
January 2026

> **Note:**  
> This document is mainly for agents and LLMs to follow when maintaining,  
> generating, or refactoring React and Next.js codebases at Vercel. Humans  
> may also find it useful, but guidance here is optimized for automation  
> and consistency by AI-assisted workflows.

---

## Abstract

Comprehensive performance optimization guide for React and Next.js applications, designed for AI agents and LLMs. Contains 40+ rules across 8 categories, prioritized by impact from critical (eliminating waterfalls, reducing bundle size) to incremental (advanced patterns). Each rule includes detailed explanations, real-world examples comparing incorrect vs. correct implementations, and specific impact metrics to guide automated refactoring and code generation.

---

## Table of Contents

1. [Eliminating Waterfalls](#1-eliminating-waterfalls) — **CRITICAL**
   - 1.1 [Defer Await Until Needed](#11-defer-await-until-needed)
   - 1.2 [Dependency-Based Parallelization](#12-dependency-based-parallelization)
   - 1.3 [Prevent Waterfall Chains in API Routes](#13-prevent-waterfall-chains-in-api-routes)
   - 1.4 [Promise.all() for Independent Operations](#14-promiseall-for-independent-operations)
   - 1.5 [Strategic Suspense Boundaries](#15-strategic-suspense-boundaries)
2. [Bundle Size Optimization](#2-bundle-size-optimization) — **CRITICAL**
   - 2.1 [Avoid Barrel File Imports](#21-avoid-barrel-file-imports)
   - 2.2 [Conditional Module Loading](#22-conditional-module-loading)
   - 2.3 [Defer Non-Critical Third-Party Libraries](#23-defer-non-critical-third-party-libraries)
   - 2.4 [Dynamic Imports for Heavy Components](#24-dynamic-imports-for-heavy-components)
   - 2.5 [Preload Based on User Intent](#25-preload-based-on-user-intent)
3. [Server-Side Performance](#3-server-side-performance) — **HIGH**
   - 3.1 [Cross-Request LRU Caching](#31-cross-request-lru-caching)
   - 3.2 [Minimize Serialization at RSC Boundaries](#32-minimize-serialization-at-rsc-boundaries)
   - 3.3 [Parallel Data Fetching with Component Composition](#33-parallel-data-fetching-with-component-composition)
   - 3.4 [Per-Request Deduplication with React.cache()](#34-per-request-deduplication-with-reactcache)
   - 3.5 [Use after() for Non-Blocking Operations](#35-use-after-for-non-blocking-operations)
4. [Client-Side Data Fetching](#4-client-side-data-fetching) — **MEDIUM-HIGH**
   - 4.1 [Deduplicate Global Event Listeners](#41-deduplicate-global-event-listeners)
   - 4.2 [Use Passive Event Listeners for Scrolling Performance](#42-use-passive-event-listeners-for-scrolling-performance)
   - 4.3 [Use SWR for Automatic Deduplication](#43-use-swr-for-automatic-deduplication)
   - 4.4 [Version and Minimize localStorage Data](#44-version-and-minimize-localstorage-data)
5. [Re-render Optimization](#5-re-render-optimization) — **MEDIUM**
   - 5.1 [Defer State Reads to Usage Point](#51-defer-state-reads-to-usage-point)
   - 5.2 [Extract to Memoized Components](#52-extract-to-memoized-components)
   - 5.3 [Narrow Effect Dependencies](#53-narrow-effect-dependencies)
   - 5.4 [Subscribe to Derived State](#54-subscribe-to-derived-state)
   - 5.5 [Use Functional setState Updates](#55-use-functional-setstate-updates)
   - 5.6 [Use Lazy State Initialization](#56-use-lazy-state-initialization)
   - 5.7 [Use Transitions for Non-Urgent Updates](#57-use-transitions-for-non-urgent-updates)
6. [Rendering Performance](#6-rendering-performance) — **MEDIUM**
   - 6.1 [Animate SVG Wrapper Instead of SVG Element](#61-animate-svg-wrapper-instead-of-svg-element)
   - 6.2 [CSS content-visibility for Long Lists](#62-css-content-visibility-for-long-lists)
   - 6.3 [Hoist Static JSX Elements](#63-hoist-static-jsx-elements)
   - 6.4 [Optimize SVG Precision](#64-optimize-svg-precision)
   - 6.5 [Prevent Hydration Mismatch Without Flickering](#65-prevent-hydration-mismatch-without-flickering)
   - 6.6 [Use Activity Component for Show/Hide](#66-use-activity-component-for-showhide)
   - 6.7 [Use Explicit Conditional Rendering](#67-use-explicit-conditional-rendering)
7. [JavaScript Performance](#7-javascript-performance) — **LOW-MEDIUM**
   - 7.1 [Batch DOM CSS Changes](#71-batch-dom-css-changes)
   - 7.2 [Build Index Maps for Repeated Lookups](#72-build-index-maps-for-repeated-lookups)
   - 7.3 [Cache Property Access in Loops](#73-cache-property-access-in-loops)
   - 7.4 [Cache Repeated Function Calls](#74-cache-repeated-function-calls)
   - 7.5 [Cache Storage API Calls](#75-cache-storage-api-calls)
   - 7.6 [Combine Multiple Array Iterations](#76-combine-multiple-array-iterations)
   - 7.7 [Early Length Check for Array Comparisons](#77-early-length-check-for-array-comparisons)
   - 7.8 [Early Return from Functions](#78-early-return-from-functions)
   - 7.9 [Hoist RegExp Creation](#79-hoist-regexp-creation)
   - 7.10 [Use Loop for Min/Max Instead of Sort](#710-use-loop-for-minmax-instead-of-sort)
   - 7.11 [Use Set/Map for O(1) Lookups](#711-use-setmap-for-o1-lookups)
   - 7.12 [Use toSorted() Instead of sort() for Immutability](#712-use-tosorted-instead-of-sort-for-immutability)
8. [Advanced Patterns](#8-advanced-patterns) — **LOW**
   - 8.1 [Store Event Handlers in Refs](#81-store-event-handlers-in-refs)
   - 8.2 [useLatest for Stable Callback Refs](#82-uselatest-for-stable-callback-refs)

---

## 1. Eliminating Waterfalls

**Impact: CRITICAL**

Waterfalls are the #1 performance killer. Each sequential await adds full network latency. Eliminating them yields the largest gains.

### 1.1 Defer Await Until Needed

**Impact: HIGH (avoids blocking unused code paths)**

Move `await` operations into the branches where they're actually used to avoid blocking code paths that don't need them.

**Incorrect: blocks both branches**

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId)
  
  if (skipProcessing) {
    return { skipped: true }
  }
  
  return processUserData(userData)
}
```

**Correct: only blocks when needed**

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) {
    return { skipped: true }
  }
  
  const userData = await fetchUserData(userId)
  return processUserData(userData)
}
```

### 1.2 Dependency-Based Parallelization

**Impact: CRITICAL (2-10× improvement)**

For operations with partial dependencies, use `better-all` to maximize parallelism. It automatically starts each task at the earliest possible moment.

**Incorrect: profile waits for config unnecessarily**

```typescript
const [user, config] = await Promise.all([
  fetchUser(),
  fetchConfig()
])
const profile = await fetchProfile(user.id)
```

**Correct: config and profile run in parallel**

```typescript
import { all } from 'better-all'

const { user, config, profile } = await all({
  async user() { return fetchUser() },
  async config() { return fetchConfig() },
  async profile() {
    return fetchProfile((await this.$.user).id)
  }
})
```

Reference: https://github.com/shuding/better-all

### 1.3 Prevent Waterfall Chains in API Routes

**Impact: CRITICAL (2-10× improvement)**

In API routes and Server Actions, start independent operations immediately, even if you don't await them yet.

**Incorrect: config waits for auth, data waits for both**

```typescript
export async function GET(request: Request) {
  const session = await auth()
  const config = await fetchConfig()
  const data = await fetchData(session.user.id)
  return Response.json({ data, config })
}
```

**Correct: auth and config start immediately**

```typescript
export async function GET(request: Request) {
  const sessionPromise = auth()
  const configPromise = fetchConfig()
  const session = await sessionPromise
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id)
  ])
  return Response.json({ data, config })
}
```

### 1.4 Promise.all() for Independent Operations

**Impact: CRITICAL (2-10× improvement)**

When async operations have no interdependencies, execute them concurrently using `Promise.all()`.

**Incorrect: sequential execution, 3 round trips**

```typescript
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()
```

**Correct: parallel execution, 1 round trip**

```typescript
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

### 1.5 Strategic Suspense Boundaries

**Impact: HIGH (faster initial paint)**

Instead of awaiting data in async components before returning JSX, use Suspense boundaries to show the wrapper UI faster while data loads.

**Incorrect: wrapper blocked by data fetching**

```tsx
async function Page() {
  const data = await fetchData()
  
  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <div>
        <DataDisplay data={data} />
      </div>
      <div>Footer</div>
    </div>
  )
}
```

**Correct: wrapper shows immediately, data streams in**

```tsx
function Page() {
  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <div>
        <Suspense fallback={<Skeleton />}>
          <DataDisplay />
        </Suspense>
      </div>
      <div>Footer</div>
    </div>
  )
}

async function DataDisplay() {
  const data = await fetchData()
  return <div>{data.content}</div>
}
```

---

## 2. Bundle Size Optimization

**Impact: CRITICAL**

Reducing initial bundle size improves Time to Interactive and Largest Contentful Paint.

### 2.1 Avoid Barrel File Imports

**Impact: CRITICAL (200-800ms import cost, slow builds)**

Import directly from source files instead of barrel files to avoid loading thousands of unused modules.

**Incorrect: imports entire library**

```tsx
import { Check, X, Menu } from 'lucide-react'
// Loads 1,583 modules, takes ~2.8s extra in dev

import { Button, TextField } from '@mui/material'
// Loads 2,225 modules, takes ~4.2s extra in dev
```

**Correct: imports only what you need**

```tsx
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'
// Loads only 3 modules (~2KB vs ~1MB)

import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
```

**Alternative: Next.js 13.5+**

```js
module.exports = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@mui/material']
  }
}
```

### 2.2 Conditional Module Loading

**Impact: HIGH (loads large data only when needed)**

Load large data or modules only when a feature is activated.

```tsx
function AnimationPlayer({ enabled, setEnabled }: { enabled: boolean; setEnabled: React.Dispatch<React.SetStateAction<boolean>> }) {
  const [frames, setFrames] = useState<Frame[] | null>(null)

  useEffect(() => {
    if (enabled && !frames && typeof window !== 'undefined') {
      import('./animation-frames.js')
        .then(mod => setFrames(mod.frames))
        .catch(() => setEnabled(false))
    }
  }, [enabled, frames, setEnabled])

  if (!frames) return <Skeleton />
  return <Canvas frames={frames} />
}
```

### 2.3 Defer Non-Critical Third-Party Libraries

**Impact: MEDIUM (loads after hydration)**

Analytics, logging, and error tracking don't block user interaction. Load them after hydration.

**Incorrect: blocks initial bundle**

```tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

**Correct: loads after hydration**

```tsx
import dynamic from 'next/dynamic'

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then(m => m.Analytics),
  { ssr: false }
)

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

### 2.4 Dynamic Imports for Heavy Components

**Impact: CRITICAL (directly affects TTI and LCP)**

Use `next/dynamic` to lazy-load large components not needed on initial render.

**Incorrect: Monaco bundles with main chunk ~300KB**

```tsx
import { MonacoEditor } from './monaco-editor'

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />
}
```

**Correct: Monaco loads on demand**

```tsx
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(
  () => import('./monaco-editor').then(m => m.MonacoEditor),
  { ssr: false }
)

function CodePanel({ code }: { code: string }) {
  return <MonacoEditor value={code} />
}
```

### 2.5 Preload Based on User Intent

**Impact: MEDIUM (reduces perceived latency)**

Preload heavy bundles before they're needed to reduce perceived latency.

```tsx
function EditorButton({ onClick }: { onClick: () => void }) {
  const preload = () => {
    if (typeof window !== 'undefined') {
      void import('./monaco-editor')
    }
  }

  return (
    <button
      onMouseEnter={preload}
      onFocus={preload}
      onClick={onClick}
    >
      Open Editor
    </button>
  )
}
```

---

## 3. Server-Side Performance

**Impact: HIGH**

Optimizing server-side rendering and data fetching eliminates server-side waterfalls and reduces response times.

### 3.1 Cross-Request LRU Caching

**Impact: HIGH (caches across requests)**

`React.cache()` only works within one request. For data shared across sequential requests, use an LRU cache.

```typescript
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 5 * 60 * 1000
})

export async function getUser(id: string) {
  const cached = cache.get(id)
  if (cached) return cached

  const user = await db.user.findUnique({ where: { id } })
  cache.set(id, user)
  return user
}
```

### 3.2 Minimize Serialization at RSC Boundaries

**Impact: HIGH (reduces payload size)**

Minimize data passed from Server Components to Client Components to reduce serialization cost.

**Incorrect: passes entire user object**

```tsx
import { UserPanel } from './user-panel'

export async function Page() {
  const user = await fetchUser()
  return <UserPanel user={user} />
}
```

**Correct: passes only needed fields**

```tsx
import { UserPanel } from './user-panel'

export async function Page() {
  const user = await fetchUser()
  return <UserPanel name={user.name} avatar={user.avatar} />
}
```

### 3.3 Parallel Data Fetching with Component Composition

**Impact: HIGH (eliminates server waterfalls)**

Restructure components to parallelize data fetching instead of sequential awaits.

**Incorrect: sequential fetches in parent**

```tsx
export default async function Page() {
  const posts = await fetchPosts()
  const comments = await fetchComments()
  return <Dashboard posts={posts} comments={comments} />
}
```

**Correct: parallel fetches via component composition**

```tsx
export default function Page() {
  return (
    <Suspense boundary>
      <Dashboard />
    </Suspense>
  )
}

async function Dashboard() {
  return (
    <div>
      <Suspense fallback={<PostsSkeleton />}>
        <Posts />
      </Suspense>
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments />
      </Suspense>
    </div>
  )
}

async function Posts() {
  const posts = await fetchPosts()
  return <PostList posts={posts} />
}

async function Comments() {
  const comments = await fetchComments()
  return <CommentList comments={comments} />
}
```

### 3.4 Per-Request Deduplication with React.cache()

**Impact: HIGH (prevents duplicate fetches within one request)**

Use `React.cache()` to deduplicate identical fetches within a single server request.

```typescript
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user) return null
  return db.user.findUnique({ where: { id: session.user.id } })
})
```

### 3.5 Use after() for Non-Blocking Operations

**Impact: MEDIUM (faster response times)**

Use `after()` to run non-critical operations after the response is sent.

```typescript
import { after } from 'next/server'

export async function POST(request: Request) {
  const data = await request.json()
  const result = await saveData(data)

  after(async () => {
    await sendNotification(data)
    await updateAnalytics(data)
  })

  return Response.json(result)
}
```

---

## 4. Client-Side Data Fetching

**Impact: MEDIUM-HIGH**

### 4.1 Deduplicate Global Event Listeners

**Impact: MEDIUM (prevents memory leaks)**

Ensure global event listeners are registered once and cleaned up properly.

```tsx
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
```

### 4.2 Use Passive Event Listeners for Scrolling Performance

**Impact: MEDIUM (prevents jank during scroll)**

Always use `{ passive: true }` for scroll and touch event listeners.

```tsx
useEffect(() => {
  const handleScroll = () => {
    setScrollY(window.scrollY)
  }
  window.addEventListener('scroll', handleScroll, { passive: true })
  return () => window.removeEventListener('scroll', handleScroll)
}, [])
```

### 4.3 Use SWR for Automatic Deduplication

**Impact: HIGH (automatic caching and deduplication)**

Use SWR for client-side data fetching to get automatic request deduplication, caching, and revalidation.

```tsx
import useSWR from 'swr'

function Profile() {
  const { data, error, isLoading } = useSWR('/api/user', fetcher)

  if (error) return <div>Failed to load</div>
  if (isLoading) return <div>Loading...</div>
  return <div>Hello {data.name}!</div>
}
```

### 4.4 Version and Minimize localStorage Data

**Impact: MEDIUM (prevents schema conflicts, reduces storage size)**

Add version prefix to keys and store only needed fields.

```typescript
const VERSION = 'v2'

function saveConfig(config: { theme: string; language: string }) {
  try {
    localStorage.setItem(`userConfig:${VERSION}`, JSON.stringify(config))
  } catch {
    // Throws in incognito/private browsing, quota exceeded, or disabled
  }
}

function loadConfig() {
  try {
    const data = localStorage.getItem(`userConfig:${VERSION}`)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}
```

---

## 5. Re-render Optimization

**Impact: MEDIUM**

Reducing unnecessary re-renders minimizes wasted computation and improves UI responsiveness.

### 5.1 Defer State Reads to Usage Point

**Impact: MEDIUM (avoids unnecessary subscriptions)**

Don't subscribe to dynamic state if you only read it inside callbacks.

**Incorrect: subscribes to all searchParams changes**

```tsx
function ShareButton({ chatId }: { chatId: string }) {
  const searchParams = useSearchParams()

  const handleShare = () => {
    const ref = searchParams.get('ref')
    shareChat(chatId, { ref })
  }

  return <button onClick={handleShare}>Share</button>
}
```

**Correct: reads on demand, no subscription**

```tsx
function ShareButton({ chatId }: { chatId: string }) {
  const handleShare = () => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    shareChat(chatId, { ref })
  }

  return <button onClick={handleShare}>Share</button>
}
```

### 5.2 Extract to Memoized Components

**Impact: MEDIUM (enables early returns)**

Extract expensive work into memoized components to enable early returns before computation.

**Incorrect: computes avatar even when loading**

```tsx
function Profile({ user, loading }: Props) {
  const avatar = useMemo(() => {
    const id = computeAvatarId(user)
    return <Avatar id={id} />
  }, [user])

  if (loading) return <Skeleton />
  return <div>{avatar}</div>
}
```

**Correct: skips computation when loading**

```tsx
const UserAvatar = memo(function UserAvatar({ user }: { user: User }) {
  const id = useMemo(() => computeAvatarId(user), [user])
  return <Avatar id={id} />
})

function Profile({ user, loading }: Props) {
  if (loading) return <Skeleton />
  return (
    <div>
      <UserAvatar user={user} />
    </div>
  )
}
```

### 5.3 Narrow Effect Dependencies

**Impact: LOW (minimizes effect re-runs)**

Specify primitive dependencies instead of objects to minimize effect re-runs.

**Incorrect: re-runs on any user field change**

```tsx
useEffect(() => {
  console.log(user.id)
}, [user])
```

**Correct: re-runs only when id changes**

```tsx
useEffect(() => {
  console.log(user.id)
}, [user.id])
```

### 5.4 Subscribe to Derived State

**Impact: MEDIUM (reduces re-render frequency)**

Subscribe to derived boolean state instead of continuous values to reduce re-render frequency.

**Incorrect: re-renders on every pixel change**

```tsx
function Sidebar() {
  const width = useWindowWidth()
  const isMobile = width < 768
  return <nav className={isMobile ? 'mobile' : 'desktop'} />
}
```

**Correct: re-renders only when boolean changes**

```tsx
function Sidebar() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  return <nav className={isMobile ? 'mobile' : 'desktop'} />
}
```

### 5.5 Use Functional setState Updates

**Impact: MEDIUM (prevents stale closures and unnecessary callback recreations)**

When updating state based on the current state value, use the functional update form.

**Incorrect: requires state as dependency**

```tsx
function TodoList() {
  const [items, setItems] = useState(initialItems)
  
  const addItems = useCallback((newItems: Item[]) => {
    setItems([...items, ...newItems])
  }, [items])
  
  return <ItemsEditor items={items} onAdd={addItems} />
}
```

**Correct: stable callbacks, no stale closures**

```tsx
function TodoList() {
  const [items, setItems] = useState(initialItems)
  
  const addItems = useCallback((newItems: Item[]) => {
    setItems(curr => [...curr, ...newItems])
  }, [])
  
  const removeItem = useCallback((id: string) => {
    setItems(curr => curr.filter(item => item.id !== id))
  }, [])
  
  return <ItemsEditor items={items} onAdd={addItems} onRemove={removeItem} />
}
```

### 5.6 Use Lazy State Initialization

**Impact: MEDIUM (wasted computation on every render)**

Pass a function to `useState` for expensive initial values.

**Incorrect: runs on every render**

```tsx
const [searchIndex, setSearchIndex] = useState(buildSearchIndex(items))
```

**Correct: runs only once**

```tsx
const [searchIndex, setSearchIndex] = useState(() => buildSearchIndex(items))
```

### 5.7 Use Transitions for Non-Urgent Updates

**Impact: MEDIUM (maintains UI responsiveness)**

Mark frequent, non-urgent state updates as transitions to maintain UI responsiveness.

```tsx
import { startTransition } from 'react'

function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0)
  useEffect(() => {
    const handler = () => {
      startTransition(() => setScrollY(window.scrollY))
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
}
```

---

## 6. Rendering Performance

**Impact: MEDIUM**

### 6.1 Animate SVG Wrapper Instead of SVG Element

**Impact: LOW (enables hardware acceleration)**

Many browsers don't have hardware acceleration for CSS3 animations on SVG elements. Wrap SVG in a `<div>` and animate the wrapper instead.

**Incorrect: animating SVG directly**

```tsx
function LoadingSpinner() {
  return (
    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" />
    </svg>
  )
}
```

**Correct: animating wrapper div**

```tsx
function LoadingSpinner() {
  return (
    <div className="animate-spin">
      <svg width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" />
      </svg>
    </div>
  )
}
```

### 6.2 CSS content-visibility for Long Lists

**Impact: HIGH (faster initial render)**

Apply `content-visibility: auto` to defer off-screen rendering.

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

### 6.3 Hoist Static JSX Elements

**Impact: LOW (avoids re-creation)**

Extract static JSX outside components to avoid re-creation.

```tsx
const loadingSkeleton = (
  <div className="animate-pulse h-20 bg-gray-200" />
)

function Container() {
  return (
    <div>
      {loading && loadingSkeleton}
    </div>
  )
}
```

### 6.4 Optimize SVG Precision

**Impact: LOW (reduces file size)**

Reduce SVG coordinate precision to decrease file size.

```bash
npx svgo --precision=1 --multipass icon.svg
```

### 6.5 Prevent Hydration Mismatch Without Flickering

**Impact: MEDIUM (avoids visual flicker and hydration errors)**

Use inline script that updates the DOM before React hydrates for client-only data.

```tsx
function ThemeWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <div id="theme-wrapper">
        {children}
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('theme') || 'light';
                var el = document.getElementById('theme-wrapper');
                if (el) el.className = theme;
              } catch (e) {}
            })();
          `,
        }}
      />
    </>
  )
}
```

### 6.6 Use Activity Component for Show/Hide

**Impact: MEDIUM (preserves state/DOM)**

Use React's `<Activity>` to preserve state/DOM for expensive components that frequently toggle visibility.

```tsx
import { Activity } from 'react'

function Dropdown({ isOpen }: Props) {
  return (
    <Activity mode={isOpen ? 'visible' : 'hidden'}>
      <ExpensiveMenu />
    </Activity>
  )
}
```

### 6.7 Use Explicit Conditional Rendering

**Impact: LOW (prevents rendering 0 or NaN)**

Use explicit ternary operators (`? :`) instead of `&&` for conditional rendering.

**Incorrect: renders "0" when count is 0**

```tsx
function Badge({ count }: { count: number }) {
  return (
    <div>
      {count && <span className="badge">{count}</span>}
    </div>
  )
}
```

**Correct: renders nothing when count is 0**

```tsx
function Badge({ count }: { count: number }) {
  return (
    <div>
      {count > 0 ? <span className="badge">{count}</span> : null}
    </div>
  )
}
```

---

## 7. JavaScript Performance

**Impact: LOW-MEDIUM**

### 7.1 Batch DOM CSS Changes

**Impact: MEDIUM (reduces reflows/repaints)**

Group multiple CSS changes together via classes or `cssText` to minimize browser reflows.

```typescript
function updateElementStyles(element: HTMLElement) {
  element.classList.add('highlighted-box')
}
```

### 7.2 Build Index Maps for Repeated Lookups

**Impact: MEDIUM (O(n) to O(1))**

Build a Map for repeated lookups instead of using find() in loops.

```typescript
const userMap = new Map(users.map(u => [u.id, u]))
const user = userMap.get(userId)
```

### 7.3 Cache Property Access in Loops

**Impact: LOW-MEDIUM (avoids repeated property lookups)**

Cache deeply nested property access in local variables when used repeatedly in loops.

```typescript
const len = items.length
for (let i = 0; i < len; i++) {
  process(items[i])
}
```

### 7.4 Cache Repeated Function Calls

**Impact: LOW-MEDIUM (avoids redundant computation)**

Cache function results in module-level Map for pure functions.

```typescript
const cache = new Map<string, Result>()

function compute(key: string): Result {
  if (cache.has(key)) return cache.get(key)!
  const result = expensiveComputation(key)
  cache.set(key, result)
  return result
}
```

### 7.5 Cache Storage API Calls

**Impact: LOW-MEDIUM (reduces storage reads)**

Cache localStorage/sessionStorage reads in module-level variables.

```typescript
let cachedTheme: string | null = undefined

function getTheme(): string {
  if (cachedTheme !== undefined) return cachedTheme
  cachedTheme = localStorage.getItem('theme') || 'light'
  return cachedTheme
}
```

### 7.6 Combine Multiple Array Iterations

**Impact: MEDIUM (reduces passes)**

Combine multiple filter/map operations into a single loop.

**Incorrect: 3 iterations**

```typescript
const active = items.filter(i => i.active)
const names = active.map(i => i.name)
const unique = [...new Set(names)]
```

**Correct: 1 iteration**

```typescript
const unique = new Set<string>()
for (const item of items) {
  if (item.active) unique.add(item.name)
}
```

### 7.7 Early Length Check for Array Comparisons

**Impact: LOW (fast rejection)**

Check array length before doing expensive element comparisons.

```typescript
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
```

### 7.8 Early Return from Functions

**Impact: LOW (avoids unnecessary computation)**

Return early from functions when conditions aren't met.

```typescript
function processUser(user: User | null): Result {
  if (!user) return emptyResult
  if (!user.isActive) return inactiveResult
  return doExpensiveProcessing(user)
}
```

### 7.9 Hoist RegExp Creation

**Impact: LOW (avoids recompilation)**

Hoist RegExp creation outside loops.

```typescript
const pattern = /prefix-(\d+)/
for (const str of strings) {
  const match = str.match(pattern)
  if (match) process(match[1])
}
```

### 7.10 Use Loop for Min/Max Instead of Sort

**Impact: MEDIUM (O(n) vs O(n log n))**

Use a simple loop for min/max instead of sorting.

```typescript
function findExtremes(projects: Project[]) {
  let oldest = projects[0]
  let newest = projects[0]
  
  for (let i = 1; i < projects.length; i++) {
    if (projects[i].updatedAt < oldest.updatedAt) oldest = projects[i]
    if (projects[i].updatedAt > newest.updatedAt) newest = projects[i]
  }
  
  return { oldest, newest }
}
```

### 7.11 Use Set/Map for O(1) Lookups

**Impact: LOW-MEDIUM (O(n) to O(1))**

Convert arrays to Set/Map for repeated membership checks.

```typescript
const allowedIds = new Set(['a', 'b', 'c', ...])
items.filter(item => allowedIds.has(item.id))
```

### 7.12 Use toSorted() Instead of sort() for Immutability

**Impact: MEDIUM-HIGH (prevents mutation bugs in React state)**

`.sort()` mutates the array in place. Use `.toSorted()` to create a new sorted array without mutation.

**Incorrect: mutates original array**

```typescript
const sorted = useMemo(
  () => users.sort((a, b) => a.name.localeCompare(b.name)),
  [users]
)
```

**Correct: creates new array**

```typescript
const sorted = useMemo(
  () => users.toSorted((a, b) => a.name.localeCompare(b.name)),
  [users]
)
```

---

## 8. Advanced Patterns

**Impact: LOW**

### 8.1 Store Event Handlers in Refs

**Impact: LOW (stable subscriptions)**

Store callbacks in refs when used in effects that shouldn't re-subscribe on callback changes.

```tsx
import { useEffectEvent } from 'react'

function useWindowEvent(event: string, handler: () => void) {
  const onEvent = useEffectEvent(handler)

  useEffect(() => {
    window.addEventListener(event, onEvent)
    return () => window.removeEventListener(event, onEvent)
  }, [event])
}
```

### 8.2 useLatest for Stable Callback Refs

**Impact: LOW (prevents effect re-runs)**

Access latest values in callbacks without adding them to dependency arrays.

```typescript
function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}
```

```tsx
function SearchInput({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState('')
  const onSearchRef = useLatest(onSearch)

  useEffect(() => {
    const timeout = setTimeout(() => onSearchRef.current(query), 300)
    return () => clearTimeout(timeout)
  }, [query])
}
```

---

## References

1. https://react.dev
2. https://nextjs.org
3. https://swr.vercel.app
4. https://github.com/shuding/better-all
5. https://github.com/isaacs/node-lru-cache
6. https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
7. https://vercel.com/blog/how-we-made-the-vercel-dashboard-twice-as-fast

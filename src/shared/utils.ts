import * as inflection from 'inflection'
import * as base64js from 'base64-js'
import pako from 'pako'
import * as R from 'ramda'
import { equals, fromPairs, toPairs, last, dropLast, ascend, mergeDeepRight } from 'ramda'

export type Dir<T> = Record<string, T>
export type Obj<T> = Record<string|symbol|number, T>
export type nullish = null|undefined
export type NonFalse<T> = T extends null | undefined | false ? never : T

export const enableBacklinks = true

export const DIRECTORY_SPACE = '[directory]'

export const ROOT_PARENT_KEY = '[ROOT]'

export function isBlank(x: any) {
  return x === null || x === undefined || x === false || (
    x instanceof Set ? x.size == 0 :
    Array.isArray(x) ? x.length == 0 :
    typeof x == 'string' ? x.match(/^\s*$/) !== null :
    typeof x == 'object' ? (
      'isBlank' in x ? x.isBlank :
      isPlainObject(x) && Object.keys(x).length == 0
    ) :
    false
  )
}

export function isPresent<T>(x: T): x is NonNullable<T> {
  return !isBlank(x)
}

export function presence<T>(x: T): T|undefined {
  if (isBlank(x)) {
    return undefined
  } else {
    return x
  }
}

export function errorIfNull<T>(val: T|nullish, message: string): T {
  if (val == null) throw new Error(message)
    return val
}

export function set<T>(args: T[]): Set<T> {
  return new Set(args)
}

export const assign = Object.assign
export const isArray = Array.isArray
export const keys = Object.keys
export const values = Object.values
export const entries = Object.entries

export function mapValues<T, T2>(obj: Obj<T>|nullish, fn: (val: T) => T2): Obj<T2> {
  return obj ? fromPairs(toPairs(obj).map(([k,v]) => [k, fn(v)])) : {}
}

export function mapKeys<T>(obj: Dir<T>, fn: (k: string) => string): Dir<T> {
  return fromPairs(toPairs(obj).map(([k,v]) => [fn(k), v]))
}

export function mapPairs<T, T2>(obj: Dir<T>, fn: (k: string, v: T) => T2): T2[] {
  return Object.keys(obj).map(k => fn(k, obj[k]))
}

export function mapObject<T, T2>(obj: Obj<T>, fn: (k: string, val: T) => [string, T2]): Obj<T2> {
  return fromPairs(toPairs(obj).map(([k,v]) => fn(k as string, v)))
}

export function filterObject<T>(obj: Dir<T>, fn: (k: string, val: T) => any): Dir<T> {
  return fromPairs(toPairs(obj).filter(([k,v]) => fn(k, v)))
}

export function filterByKeys<T>(obj: Dir<T>, fn: (k: string) => any): Dir<T> {
  const result = {} as Dir<T>
  for (const k of keys(obj)) {
    if (fn(k)) result[k] = obj[k]
  }
  return result
}

export function filterByValues<T>(obj: Dir<T>, fn: (v: T) => any): Dir<T> {
  const result = {} as Dir<T>
  for (const k of keys(obj)) {
    const val = obj[k]
    if (fn(val)) result[k] = val
  }
  return result
}

export function mapToObject<T, T2>(arr: T[]|nullish, fn: (x: T) => [string, T2]|nullish): Dir<T2> {
  if (!arr) return {}
  return fromPairs(keep(arr, fn))
}

export function eachPair<K extends string|number|symbol, T>(obj: Record<K, T>|nullish, fn: (k: K, val: T) => void): void {
  if (obj) {
    toPairs(obj).forEach(([k,v]) => fn(k as K, v))
  }
}

export function eachValue<T>(obj: Dir<T>|nullish, fn: (x: T) => void): void {
  if (obj) values(obj).forEach(x => fn(x))
}

export function eachKey<T>(obj: Dir<T>|nullish, fn: (k: string) => void): void {
  if (obj) {
    keys(obj).forEach(k => fn(k))
  }
}

export function each<T>(arr: readonly T[]|nullish, fn: (x: T) => any): void {
  if (arr != null) {
    arr.forEach(x => fn(x))
  }
}

export async function awaitEach(arr: readonly any[]|nullish, fn: (x: any) => Promise<any>): Promise<void> {
  if (arr != null) {
    for (const key in arr) {
      await fn(arr[key])
    }
  }
}

export async function awaitMapAll<T1, T2>(arr: readonly T1[]|nullish, fn: (T1: any) => Promise<T2>): Promise<T2[]> {
  if (arr != null) {
    return await Promise.all(arr.map(x => fn(x)))
  } else {
    return []
  }
}

export async function awaitMapPairs<T extends object, T2>(obj: T|nullish, fn: (k: keyof T, val: T[keyof T]) => Promise<T2>): Promise<T2[]> {
  if (obj == null) return []
  return await Promise.all(toPairs(obj).map(([k, v]) => fn(k as keyof T, v)))
}

export async function awaitMapEach<T1, T2>(arr: readonly T1[]|nullish, fn: (T1: any) => Promise<T2>): Promise<T2[]> {
  const result = [] as T2[]
  if (arr != null) {
    for (const key in arr) {
      result.push(await fn(arr[key]))
    }
  }
  return result
}

export async function awaitEachPair<T extends object>(obj: T|nullish, fn: (k: keyof T, val: T[keyof T]) => Promise<void>): Promise<void> {
  if (obj) await awaitEach(toPairs(obj), ([k,v]) => fn(k, v))
}

export async function awaitMapValues
  <K extends string|number|symbol, T1, T2, O1 extends Record<K, T1>, O2 extends Record<K, T2>>
  (obj: O1, f: (val: T1) => Promise<T2>): Promise<O2> {
    const result = {} as O2
    await awaitEach(toPairs(obj), async ([k, v]: [K, T1]) => {
      (result as any)[k] = await f(v)
    })
    return result
}


export async function awaitEachValue<T>(obj: Dir<T>, fn: (x: T) => Promise<void>): Promise<void> {
  await awaitEach(values(obj), fn)
}

export async function awaitEachKey<T>(obj: Dir<T>, fn: (k: string) => Promise<void>): Promise<void> {
  await awaitEach(keys(obj), fn)
}

export function keep<T, T2>(obj: Dir<T>|nullish, f: (k: string, v: T) => T2|nullish|false): Exclude<T2, null|undefined|false>[]
export function keep<T, T2>(arr: readonly T[]|nullish, f: (x:T) => T2|nullish|false): Exclude<T2, null|undefined|false>[]
export function keep<T2>(objOrArr: any, f: any) {
  const result = [] as Exclude<T2, null|undefined|false>[]
  if (objOrArr) {
    if (Array.isArray(objOrArr)) {
      const arr = objOrArr as any[]
      arr?.forEach(x => {
        const y = f(x)
        if (y != null && y !== false) result.push(y)
      })
      return result
    } else {
      const obj = objOrArr as Dir<any>
      for (const k of Object.keys(obj)) {
        const y = f(k, obj[k])
        if (y != null && y !== false) result.push(y)
      }
    }
  } 
  return result
}

export function keepFirst<T, T2>(arr: readonly T[]|nullish, f: (x:T) => T2|nullish): T2|undefined
export function keepFirst<T, T2>(arr: Dir<T>|nullish, f: (k: string, v: T) => T2|nullish): T2|undefined
export function keepFirst(objOrArr: any, f: any) {
  if (objOrArr) {
    if (Array.isArray(objOrArr)) {
      const arr = objOrArr as any[]
      if (arr) {
        for (const x of arr) {
          const y = f(x)
          if (y != null && y !== false) return y       
        }
      }
    } else {
      const obj = objOrArr as Dir<any>
      for (const k of Object.keys(obj)) {
        const y = f(k, obj[k])
        if (y != null && y !== false) return y        
      }
    }
  }
  return undefined
}

export function arrayRemove<T>(arr: T[], ...xs: T[]) {
  for (const x of xs) {
    const i = arr.indexOf(x)
    if (~i) {
      arr.splice(i, 1)
    }
  }
}

export function arrayWithout<T>(arr: readonly T[], x: T): readonly T[] {
  const i = arr.indexOf(x)
  if (i !== -1) {
    const result = [...arr]
    result.splice(i, 1)
    return result
  } else {
    return arr
  }
}

export function reject<T>(arr: readonly T[]|nullish, f: (x:T) => any): T[] {
  if (arr) {
    return arr.filter(x => !f(x))
  } else {
    return []
  }
}

export function contains<T>(arr: readonly T[]|nullish, x: T): boolean {
  return arr != null && arr.indexOf(x) != -1
}

export function equalsBy(attrs: string[], o1: Dir<any>, o2: Dir<any>) {
  const result = attrs.every(a => equals(o1[a], o2[a]))
  return result
}

export function equalsIgnoring(ignore: string[], o1: Dir<any>, o2: Dir<any>) {
  const ign = new Set(ignore)
  const done = new Set
  
  for (const k in o1) {
    (globalThis as any).equalsIgnoringLast = [k, o1, o2]
    if (ign.has(k)) continue
    if (!(k in o2 && equals(o1[k], o2[k]))) return false
    done.add(k)
  }

  for (const k in o2) {
    (globalThis as any).equalsIgnoringLast = [k, o1, o2]
    if (ign.has(k) || done.has(k)) continue
    if (!(k in o1 && equals((o1 as any)[k], (o2 as any)[k]))) return false
  }

  return true
}

export function ensure<T>(dir:any, f1: string, v:T): T
export function ensure<T>(dir:any, f1: string, f2: string, v:T): T
export function ensure<T>(dir:any, f1: string, f2: string, f3: string, v:T): T
export function ensure<T>(dir:any, f1: string, f2: string, f3: string, f4: string, v:T): T
export function ensure<T>(dir:any, f1: string, f2: string, f3: string, f4: string, f5: string, v:T): T
export function ensure<T>(dir:any, f1: string, f2: string, f3: string, f4: string, f5: string, f6: string, v:T): T
export function ensure(dir: any, ...args: any[]) {
  let val = last(args)
  let obj = dir
  const fields = dropLast(2, args)
  const lastField = args[args.length-2]

  fields.forEach(field => {
    if (!(typeof field == 'string')) { throw new Error('bad field in ensure') }
    if (obj[field] == null) obj[field] = {}
    obj = obj[field]
  })
  if (obj[lastField] == null) obj[lastField] = val

  return obj[lastField]
}

export function moveKey(obj: Dir<any>, oldKey: string, newKey: string) {
  const val = obj[oldKey]
  obj[newKey] = val
  delete obj[oldKey]
  return val
}

export function extend<T>(arr: T[], more: null|undefined|T[]) {
  if (more) {
    for (const x of more) arr.push(x)
  }
}

export function firstPresent<T, T2>(arr: T[], f: (x:T, i:string) => T2): T2|null {
  for (const i in arr) {
    const x = arr[i]
    const res = f(x, i)
    if (res) return res
  }
  return null
}

// Avoid creating possible large array with Object.keys[0]
export function someKey(o: object): string|null {
  let id: string|null = null;
  for (id in o) { break; }
  return id
}

export function toSet<T>(coll: T[]|Set<T>|nullish): Set<T> {
  if (!coll) {
    return new Set()
  } else if (Array.isArray(coll)) {
    return new Set(coll)
  } else {
    return coll
  }
}

export function union<T>(coll1: T[]|Set<any>|nullish, coll2: T[]|Set<any>|nullish): Set<T> {
  if (!coll1) {
    return toSet(coll2)
  } if (!coll2) {
    return toSet(coll2)
  } else {
    const result = new Set(toSet(coll1))
    for (const x of coll2) result.add(x)
    return result
  }
}

export function difference<T>(coll1: T[]|Set<any>|nullish, coll2: T[]|Set<any>|nullish): Set<T> {
  if (!coll1) {
    return new Set()
  } else if (!coll2) {
    return toSet(coll1)
  } else {
    const result = new Set(toSet(coll1))
    for (let x of coll2) {
        result.delete(x)
    }
    return result
  }
}


export function pipe<V, T1>(x: V, fn0: (x: V) => T1): T1;
export function pipe<V, T1, T2>(x: V, fn0: (x: V) => T1, fn1: (x: T1) => T2): T2;
export function pipe<V, T1, T2, T3>(x: V, fn0: (x: V) => T1, fn1: (x: T1) => T2, fn2: (x: T2) => T3): T3;
export function pipe<V, T1, T2, T3, T4>(x: V, fn0: (x: V) => T1, fn1: (x: T1) => T2, fn2: (x: T2) => T3, fn3: (x: T3) => T4): T4;
export function pipe<V, T1, T2, T3, T4, T5>(x: V, fn0: (x: V) => T1, fn1: (x: T1) => T2, fn2: (x: T2) => T3, fn3: (x: T3) => T4, fn4: (x: T4) => T5): T5;
export function pipe<V, T1, T2, T3, T4, T5, T6>(x: V, fn0: (x: V) => T1, fn1: (x: T1) => T2, fn2: (x: T2) => T3, fn3: (x: T3) => T4, fn4: (x: T4) => T5, fn5: (x: T5) => T6): T6;
export function pipe<V, T1, T2, T3, T4, T5, T6, T7>(fn0: (x: V) => T1, fn1: (x: T1) => T2, fn2: (x: T2) => T3, fn3: (x: T3) => T4, fn4: (x: T4) => T5, fn5: (x: T5) => T6, fn: (x: T6) => T7): T7;
export function pipe<V, T1, T2, T3, T4, T5, T6, T7, T8>(x: V, fn0: (x: V) => T1, fn1: (x: T1) => T2, fn2: (x: T2) => T3, fn3: (x: T3) => T4, fn4: (x: T4) => T5, fn5: (x: T5) => T6, fn6: (x: T6) => T7, fn: (x: T7) => T8): T8;
export function pipe<V, T1, T2, T3, T4, T5, T6, T7, T8, T9>(x: V, fn0: (x: V) => T1, fn1: (x: T1) => T2, fn2: (x: T2) => T3, fn3: (x: T3) => T4, fn4: (x: T4) => T5, fn5: (x: T5) => T6, fn6: (x: T6) => T7, fn7: (x: T7) => T8, fn8: (x: T8) => T9): T9;
export function pipe<V, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(x: V, fn0: (x: V) => T1, fn1: (x: T1) => T2, fn2: (x: T2) => T3, fn3: (x: T3) => T4, fn4: (x: T4) => T5, fn5: (x: T5) => T6, fn6: (x: T6) => T7, fn7: (x: T7) => T8, fn8: (x: T8) => T9, fn9: (x: T9) => T10): T10;

export function pipe(x: any, ...fns: any[]) {
  for (const f of fns) {
    x = f(x)
  }
  return x
}

export function raise(message: string) {
  throw new Error(message)
}

export function assignWhere<T extends object>(obj: T, fn: (x:any)=>any, fields: Partial<T>|nullish): T {
  if (!fields) return obj
  R.keys(fields).forEach(k => {
    const v = fields[k]
    if (fn(v)) {
      (obj as any)[k] = v
    }
  })
  return obj
}


export function assignUnlessNullish<T extends object>(obj: T, fields: Partial<T>): T {
  return assignWhere(obj, x => x != null, fields)
}

export function assignUnlessNull<T extends object>(obj: T, fields: Partial<T>): T {
  return assignWhere(obj, x => x !== null, fields)
}

export function assignUnlessUndefined<T extends object>(obj: T, fields: Partial<T>): T {
  return assignWhere(obj, x => x !== undefined, fields)
}

export function assignPresent<T extends object>(obj: T, fields: Partial<T>|nullish): T {
  return assignWhere(obj, isPresent, fields)
}

export function allIDs(arr: {id:string}[]): string[] {
  return arr ? arr.map(x => x.id) : []
}

export function undefinedToNull(obj: Obj<any>) {
  const result = {...obj}
  eachPair(result, (k,v) => {
    if (v === undefined) result[k] = null
  })
  return result 
}

export function objectDiff(before: Obj<any>, after: Obj<any>, options?: {ignore?: (string|symbol|number)[]}) {
  let empty = true
  const result = {} as Obj<any>

  const ignore = options?.ignore ? new Set(options.ignore) : null

  keys(after).forEach(k => {
    const av = after[k]
    if (!ignore?.has(k)) {
      const bv = before[k]
      if (!equals(bv, av)) {
        empty = false
        result[k] = av
      }
    }
  })
  eachKey(before, k => {
    if (!ignore?.has(k))  {
      if (!(k in after)) {
        empty = false
        result[k] = undefined
      }
    }
  })
  return empty ? null : result
}

export function isObject(x: any): x is Record<string|number|symbol, any> {
  return x != null && typeof x == 'object' && !Array.isArray(x)
}

export function mulitSorter<T>(...fns: ((a: T, b: T) => number)[]) {
  return function(a: T, b: T) {
    var result = 0
    var i = 0
    while (result === 0 && i < fns.length) {
      result = fns[i](a, b)
      i += 1
    }
    return result
  }
}

export function sortBy<T>(arr: T[], fn: (x:T) => any): T[] {
  return arr.sort(ascend(fn))
}

export function maxBy<T, T2>(arr: T[], fn: (x:T) => T2): T {
  return arr.reduce((a: T, b: T) => fn(a) > fn(b) ? a : b)
}

export function order<T extends {order?: string}>(arr: T[]): T[] {
  return arr.sort(ascend(x => x.order ?? ''))
}

export function findIndexFrom<T>(arr: T[], index: number, f: (x:T) => any): number|null {
  const {length} = arr
  for (let i = index; i <= length; i++) {
    if (f(arr[i])) {
      return i
    }
  }
  return null
}

export function assertOwnProperty(obj: object, property: string) {
  if (!obj.hasOwnProperty(property)) {
    throw new Error(`Expected object to have property ${property}`)
  }
}

// Similar to Object.assign, but also merges property getters/setters
export function mergeObjects<T1, T2>(o1: T1, o2: T2): T1 & T2
export function mergeObjects<T1, T2, T3>(o1: T1, o2: T2, o3: T3): T1 & T2 & T3
export function mergeObjects<T1, T2, T3, T4>(o1: T1, o2: T2, o3: T3, o4: T4): T1 & T2 & T3 & T4
export function mergeObjects<T1, T2, T3, T4, T5>(o1: T1, o2: T2, o3: T3, o4: T4, o5: T5): T1 & T2 & T3 & T4 & T5
export function mergeObjects<T1, T2, T3, T4, T5, T6>(o1: T1, o2: T2, o3: T3, o4: T4, o5: T5, o6: T6): T1 & T2 & T3 & T4 & T5 & T6
export function mergeObjects<T1, T2, T3, T4, T5, T6, T7>(o1: T1, o2: T2, o3: T3, o4: T4, o5: T5, o6: T6, o7: T7): T1 & T2 & T3 & T4 & T5 & T6 & T7
export function mergeObjects<T1, T2, T3, T4, T5, T6, T7, T8>(o1: T1, o2: T2, o3: T3, o4: T4, o5: T5, o6: T6, o7: T7, o8: T8): T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8

export function mergeObjects(...objects: any[]): any {
  const result = {}
  objects.forEach(o => {
    Object.defineProperties(result, Object.getOwnPropertyDescriptors(o))
  })
  return result
}

export function assertNotNull<T>(x: T, message?: string): asserts x is NonNullable<T> {
  if (x == null) throw new Error(`Not-null assertion failed. ${message ?? ''}`)
}

export function assertIsA<T>(x: any): asserts x is T {
}

export function assertInstanceOf<T>(obj: any, clazz?: abstract new (...args: any[]) => T): asserts obj is T {
  if (clazz && !(obj instanceof clazz)) {
    throw new Error(`Object is not an instance of ${clazz.name}`);
  }
}

// Hot reloading safe version of instanceof
export function instanceOf<T>(obj: any, clazz: string|(abstract new (...args: any[]) => T)): obj is T {
  if (!obj) return false
  return obj.constructor.name == (typeof clazz == 'string' ? clazz : clazz.name) || instanceOf(Object.getPrototypeOf(obj), clazz)
}

export function whenInstance<T>(clazz: string|(abstract new (...args: any[]) => T), obj: any): T|undefined {
  if (instanceOf(obj, clazz)) {
    return obj
  }
}

export function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

function _compact<T extends object|any[]>(obj: T, test: (x:any) => any): T {
  if (Array.isArray(obj)) {
    return obj.filter(x => !test(x)) as unknown as T
  } else {
    const result = {} as any
    for (const k of Object.keys(obj)) {
      const val = (obj as any)[k]
      if (!test(val)) result[k] = val
    }
    return result
  }
}

export function compact<T>(obj: (T|nullish)[]): Exclude<T, nullish>[]
export function compact<T extends object>(obj: T): {[K in keyof T]: Exclude<T[K], nullish>}
export function compact(obj: any) {
  return _compact(obj, x => x == null)
}

export function withoutNulls<T extends object|any[]>(obj: T): T {
  return _compact(obj, x => x === null)
}

export function withoutUndefineds<T extends object|any[]>(obj: T): {[K in keyof T]: Exclude<T[K], undefined>} {
  return _compact(obj, x => x === undefined) as any
}

export function withoutNullish<T extends object|any[]>(obj: T): T {
  return _compact(obj, x => x == null)
}

export function withoutFalsy<T>(obj: (T|nullish)[]): Exclude<T, null|false>[]
export function withoutFalsy<T extends object>(obj: T): {[K in keyof T]: Exclude<T[K], null|false>}
export function withoutFalsy(obj: any) {
  return _compact(obj, x => !x)
}

export function withoutBlanks<T>(obj: T[]): NonFalse<T>[]
export function withoutBlanks<T extends object>(obj: T): {[K in keyof T]: NonFalse<T[K]>}
export function withoutBlanks(obj: any): any {
  return _compact(obj, isBlank)
}

export function defaults<T, T2 extends Partial<T>>(obj: T, defaults: T2): T & T2 {
  const result = {...obj} as any
  for (const k of Object.keys(defaults)) {
    if (result[k] == null && k in defaults) result[k] = (defaults as any)[k]
  }
  return result
}

export function tap<T>(x: T, f: (x:T) => void): T {
  f(x)
  return x
}

export function groupByObject<T, K extends keyof T>(objects: T[], key: K): Map<T[K], T[]> {
  const result = new Map<T[K], T[]>()
  for (const obj of objects) {
    const keyObj = obj[key]
    const got = result.get(keyObj)
    if (got) {
      got.push(obj)
    } else {
      result.set(keyObj, [obj])
    }
  }
  return result
}

export function stripIndent(str: string) {
  const m = /^(\s*\n)*(\s*)(?=\S)/.exec(str)
  if (m) {
    const result = str
      .substring(m[0].length, str.length)
      .replace(new RegExp(`\\n {${m[2].length}}`, 'g'), "\n")
      .trimEnd()
    return str.match(/\n *$/) ? result + '\n' : result
  } else return str
}

export function rescue<T>(f: () => T, fallback: T|undefined = undefined, report?: string): T|undefined {
  try {
    return f()
  } catch (e) {
    if (report) {
      console.error(report)
      console.error(e)
    }
    return fallback
  }
}

export function separate<T>(arr: T[], fn: (x:T) => any): [T[], T[]] {
  const yes = [] as T[], no = [] as T[]
  for (const x of arr) {
    if (fn(x)) {
      yes.push(x)
    } else {
      no.push(x)
    }
  }
  return [yes, no]
}

export function isPlainObject(x: any) {
  return x && (x.constructor === Object || x.constructor === undefined)
}

export function slugify(str: string) {
  if (!str || typeof str !== 'string') return ''
  return stripHTMLTags(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll(/[^a-z]+/g, '-')
    .replaceAll(/^-|-$/g, '')
}

export function stripHTMLTags(input: string): string {
  return input.replace(/<\/?[^>]+(>|$)/g, "")
}

export function splitKey(key: string|nullish) {
  if (key == null) return [undefined, undefined]
  const m = key.match(/^(.+?)\/(.+)/)!
  if (!m) return [null, null]
  const [, type, id] = m
  return [type, id]
}

export function isKeyFormat(s: string, type?: string) {
  const match = typeof s == 'string' && s.match(/^(.+?)\/[^/]+$/)
  return type ? (match && match[1] == type) : match != null
}

export function isSubclass(sub: any, parent: any): boolean {
  let proto = Object.getPrototypeOf(sub)
  
  while (proto !== null) {
    if (proto === parent) return true
    proto = Object.getPrototypeOf(proto)
  }

  return false
}

export function withProto(proto: object, obj: Dir<any>) {
  const result = Object.create(proto)
  Object.assign(result, obj)
  return result
}

export function deflateJSON(json: any) {
  const string = JSON.stringify(json)
  const data = pako.deflate(string)
  return base64js.fromByteArray(data)
}

export function inflateJSON(str: string) {
  const data = base64js.toByteArray(str)
  const json = pako.inflate(data, { to: 'string' })
  return JSON.parse(json)
}

export function blankObj<T>(): Dir<T> {
  return Object.create(null)
}

export function dashesToSpace(s: string) {
  return s.replaceAll(/-+/g, ' ')
}

export function dashedToCamel(s: string) {
  return inflection.camelize(s.replaceAll('-', '_'), true)
}

export function pusherChannelName(name: string) {
  return name.replaceAll(/[^a-zA-Z0-9_\-=@,.;]/g, '.')
}

export function setDiff(oldSet: Set<string>, newSet: Set<string>): { added: Set<string>, removed: Set<string> } {
  const added = new Set<string>()
  const removed = new Set<string>()

  for (const item of newSet) if (!oldSet.has(item)) added.add(item)
  for (const item of oldSet) if (!newSet.has(item)) removed.add(item)

  return { added, removed }
}

export function formatPrice(price: string|number, currency?: string) {
  const p = typeof price == 'string' ? parseFloat(price) : price
  const num = Intl.NumberFormat().format(p)
  return (
    currency == 'sek' ? num + ' kr' :
    currency == 'eur' ? '€' + num :
    currency == 'gbp' ? '£' + num :
    currency == 'usd' ? '$' + num :
    num
  )
}

export function scriptName(name: string) {
  return name.trim().toLowerCase().replaceAll(/[^a-zA0-9]+/g, '_')
}

export function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function digest(str: string): string {
  var hash = 0, i, chr;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

export function deepAssign<T extends object>(target: T, ...sources: Partial<T>[]): T {
  for (const source of sources) {
    if (!source) continue
    for (const key in source) {
      const tv = target[key]
      const sv = source[key] as T[Extract<keyof T, string>]
      if (isObject(tv) && isObject(sv)) {
        deepAssign(tv, sv)
      } else {
        target[key] = sv
      }
    }
  }
  return target
}

export function noKeysExcept(obj: object, ...ks: string[]): boolean {
  const objKeys = keys(obj)
  if (objKeys.length > ks.length) return false
  for (const key of objKeys) {
    if (!ks.includes(key)) return false
  }
  return true
}

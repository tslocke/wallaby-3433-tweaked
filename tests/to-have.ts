import { last, equals, keys } from "ramda"
import { firstPresent, isPlainObject } from '@shared/utils.js'

export function toHave(received: any, pattern: any) {
  const fail = matchValue(received, pattern, [])
  if (fail) {
    return {pass: false, message: () => 
      `at ${fail.path.join('.')}, ${fail.message ?? `expected ${messageValue(fail.expected)}, got ${messageValue(fail.got)}`}`}
  } else {
    return {pass: true, message: () => 'toHave does not support negation with .not' }
  }
}

function matchObject(obj: any, expects: any, parentPath: string[] =[]): any {
  if (obj == null) {
    return {path: parentPath, expected: expects.class ? `a ${expects.class.name}` : 'an object', got: obj}
  } else {
    let k: string, v: any
    for ([k, v] of Object.entries(expects)) {
      if (k.match(/\$\$$/)) {
        const val = fieldValue(obj, k.slice(0, k.length-2))
        throw new Error(JSON.stringify(val))
      }

      if (k.includes('.')) {
        // expand {'a.b.c': something} into {a: {b: {c: something}}}
        const val = v
        const names = k.split('.')
        k = names[0]
        v = {}
        let c: any = v
        for (const name of names.slice(1, names.length-1)) {
          c = c[name] = {}
        }
        c[last(names) as string] = val;
      }

      const path: string[] = [...parentPath, k]
      const fail = matchField(obj, k, v, path)
      if (fail) return fail
    }

    if (expects.$$only) {
      const keys = new Set(Object.keys(obj))
      for (const k of Object.keys(expects)) {
        keys.delete(k)
      }
      if (keys.size > 0) {
        return {path: parentPath, expected: lit("no extra keys"), got: lit([...keys].join(', '))}
      }

    }
  }
  return null
}

function matchField(obj: any, fieldName: string, matcher: any, path: string[]): any {
  if (fieldName == '$$only') return null  // skip - handled in matchObject
  return matchValue(fieldValue(obj, fieldName), matcher, path)
}

function fieldValue(obj: any, fieldName: string) {
  return fieldName === 'class' ? obj.constructor :
         fieldName === '$$keys' ? new Set(Object.keys(obj).sort()) :
         fieldName === '$$size' ? Object.keys(obj).length :
         fieldName === '$$type' ? typeof obj :
         obj[fieldName]
}

function matchValue(value: any, matcher: any, path: string[]): any {
  if (Array.isArray(matcher)) {
    if (value instanceof Set) {
      matcher = new Set(matcher)
      if (!equals(value, matcher)) {
        return {path, expected: matcher, got: value}
      }

    } else if (!Array.isArray(value)) {
      return {path, expected: lit('array'), got: value}

    } else {
      if (value.length !== matcher.length) {
        return {path, expected: lit(`length ${matcher.length}`), got: lit(`length ${value?.length}`)}
      }
      
      const indexes = keys(matcher) as string[]
      return firstPresent(indexes, (i) => matchField(value, i as string, matcher[i], [...path, i]))
    }

  } else if (typeof matcher == 'function') {
    if (!matcher(value)) {
      return {path, message: 'predicate failed'}
    }

  } else if (typeof matcher == 'object' && matcher != null && isPlainObject(matcher)) {
    return matchObject(value, matcher, path)

  } else {
    if (value !== matcher) {
      return {path, expected: matcher, got: value}
    }
  }

  return null
}

const literalToken = {}

function messageValue(x: any) {
  if (x?.literalToken === literalToken) {
    return x.s
  } else if (x instanceof Set) {
    return `Set<${JSON.stringify([...x])}>`
  } else {
    return JSON.stringify(x)
  }
}

function lit(s: string) {
  return {s, literalToken}
}

export function exactly(x: any) {
  x.$$only = true
  return x
}

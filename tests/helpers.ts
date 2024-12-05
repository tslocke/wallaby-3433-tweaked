globalThis.ResizeObserver = (class { observe() {} unobserve() {} disconnect() {} })
globalThis.Range.prototype.getClientRects = () => [] as any

import { EditorView } from 'prosemirror-view'
import { isBlank } from '@shared/utils'
import { toHave } from './to-have'

(EditorView.prototype as any).scrollToSelection = () => {}

if (typeof expect != 'undefined') {
  expect.extend({

    toHave,

    toBeNode(node, expected) {
      const pass = node.is(expected)
      return { pass, message: () => pass ? "is the expected pos" : "is not the expected pos" }
    },

    toBeBlank(val) {
      const pass = isBlank(val)
      return { pass, message: () => pass ? "is blank" : "is not blank"}
    }

  });
}

export { exactly } from './to-have'

export function foo() {}

/////////////////////////////////////////////////////////////////



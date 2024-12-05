import { foo } from './helpers'

foo()

describe('test something', () => {
  test('whatever', () => {
    expect(true).toBe(true)
  })
  test('something else', async () => {
    expect(true).toBe(true)
  })
  test('another', () => {
  })
})

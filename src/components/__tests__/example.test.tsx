import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

// 示例组件测试
describe('Example Test Suite', () => {
  it('should run a basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should render test text', () => {
    render(<div data-testid="test-element">Test Content</div>)
    const element = screen.getByTestId('test-element')
    expect(element).toBeTruthy()
    expect(element.textContent).toBe('Test Content')
  })
})

import { useEffect, useRef, useCallback } from 'react'

interface FocusableElement {
  focus: () => void
}

export function useFocusManagement() {
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([])
  const currentIndexRef = useRef(0)

  const registerInput = useCallback((index: number) => (element: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRefs.current[index] = element
  }, [])

  const focusNextInput = useCallback(() => {
    const nextIndex = currentIndexRef.current + 1
    const nextInput = inputRefs.current[nextIndex]

    if (nextInput) {
      nextInput.focus()
      currentIndexRef.current = nextIndex
      return true
    }
    return false
  }, [])

  const focusPreviousInput = useCallback(() => {
    const prevIndex = currentIndexRef.current - 1
    const prevInput = inputRefs.current[prevIndex]

    if (prevInput) {
      prevInput.focus()
      currentIndexRef.current = prevIndex
      return true
    }
    return false
  }, [])

  const focusInputByIndex = useCallback((index: number) => {
    const input = inputRefs.current[index]
    if (input) {
      input.focus()
      currentIndexRef.current = index
      return true
    }
    return false
  }, [])

  const focusFirstInput = useCallback(() => {
    const firstInput = inputRefs.current[0]
    if (firstInput) {
      firstInput.focus()
      currentIndexRef.current = 0
      return true
    }
    return false
  }, [])

  const focusLastInput = useCallback(() => {
    const lastIndex = inputRefs.current.length - 1
    const lastInput = inputRefs.current[lastIndex]
    if (lastInput) {
      lastInput.focus()
      currentIndexRef.current = lastIndex
      return true
    }
    return false
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement
      if (target.tagName === 'TEXTAREA' && !event.ctrlKey) {
        return // Allow multiline in textareas
      }
      
      // Try to focus next input on Enter
      if (!focusNextInput()) {
        // If no next input, submit form or move to next section
        const form = target.form
        if (form) {
          const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement
          if (submitButton) {
            submitButton.click()
          }
        }
      }
    } else if (event.key === 'ArrowDown' && event.ctrlKey) {
      focusNextInput()
    } else if (event.key === 'ArrowUp' && event.ctrlKey) {
      focusPreviousInput()
    }
  }, [focusNextInput, focusPreviousInput])

  const updateCurrentIndex = useCallback((element: FocusableElement | null) => {
    const index = inputRefs.current.findIndex(ref => ref === element)
    if (index !== -1) {
      currentIndexRef.current = index
    }
  }, [])

  return {
    registerInput,
    focusNextInput,
    focusPreviousInput,
    focusInputByIndex,
    focusFirstInput,
    focusLastInput,
    handleKeyDown,
    updateCurrentIndex,
    currentIndex: currentIndexRef.current
  }
}

export function useAutoFocus(inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>, condition = true) {
  useEffect(() => {
    if (condition && inputRef.current) {
      // Small delay to ensure the element is fully rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select?.()
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [inputRef, condition])
}

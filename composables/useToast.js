export const useToast = () => {
  const { $toast } = useNuxtApp()

  const success = (message) => {
    if ($toast) {
      $toast.success(message)
    }
  }

  const error = (message) => {
    if ($toast) {
      $toast.error(message)
    }
  }

  const info = (message) => {
    if ($toast) {
      $toast.info(message)
    }
  }

  const warning = (message) => {
    if ($toast) {
      $toast.warning(message)
    }
  }

  return {
    success,
    error,
    info,
    warning
  }
} 
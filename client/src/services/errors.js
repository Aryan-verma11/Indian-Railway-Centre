const SERVER_MESSAGE_STATUSES = [400, 401, 403, 404, 409, 429];

export function getErrorMessage(error) {
  if (!error.response) return 'Cannot reach the server. Check your connection and try again.';
  const { status, data } = error.response;
  if (SERVER_MESSAGE_STATUSES.includes(status) && typeof data?.message === 'string') return data.message;
  return 'Unable to complete the request. Please try again.';
}

export const getFieldErrors = (error) => error.response?.data?.errors || {};

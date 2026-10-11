export const formatDate = (value) => (value ? value.split('-').reverse().join('-') : '-');
export const formatDateTime = (value) => (value ? value.replace('T', ' ').slice(0, 19) : 'Never');

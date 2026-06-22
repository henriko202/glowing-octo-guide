import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// No incremental (ISR) cache: the landing renders from local dictionaries with no
// runtime data, so the default in-memory behavior is all we need.
export default defineCloudflareConfig()

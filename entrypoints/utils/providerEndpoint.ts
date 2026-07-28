import type { CustomProvider, CustomProviderProtocol } from './model'

export const customProviderProtocols: CustomProviderProtocol[] = ['openai', 'anthropic']

export function getCustomProviderProtocol(
    provider?: Pick<CustomProvider, 'protocol'>,
): CustomProviderProtocol {
    return provider?.protocol === 'anthropic' ? 'anthropic' : 'openai'
}

function completeEndpointPath(pathname: string, protocol: CustomProviderProtocol): string {
    const normalizedPath = pathname.replace(/\/+$/, '')

    if (protocol === 'anthropic') {
        if (normalizedPath.endsWith('/messages')) return normalizedPath
        if (normalizedPath.endsWith('/v1')) return `${normalizedPath}/messages`
        return `${normalizedPath}/v1/messages`
    }

    if (normalizedPath.includes('/api/generate')) return normalizedPath
    if (normalizedPath.endsWith('/chat/completions')) return normalizedPath
    if (normalizedPath.endsWith('/v1')) return `${normalizedPath}/chat/completions`
    return `${normalizedPath}/v1/chat/completions`
}

export function resolveProviderEndpoint(
    endpoint: string,
    protocol: CustomProviderProtocol,
): string {
    const trimmed = endpoint.trim()
    if (!trimmed) return ''

    try {
        const parsed = new URL(trimmed)
        parsed.pathname = completeEndpointPath(parsed.pathname, protocol)
        parsed.hash = ''
        return parsed.toString()
    } catch {
        const hashIndex = trimmed.indexOf('#')
        const withoutHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed
        const queryIndex = withoutHash.indexOf('?')
        const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
        const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : ''
        return `${completeEndpointPath(path, protocol)}${search}`
    }
}

export function resolveOpenAICompatibleEndpoint(endpoint: string): string {
    return resolveProviderEndpoint(endpoint, 'openai')
}

export function resolveAnthropicCompatibleEndpoint(endpoint: string): string {
    return resolveProviderEndpoint(endpoint, 'anthropic')
}

export function resolveCustomProviderEndpoint(
    provider?: Pick<CustomProvider, 'url' | 'protocol'>,
): string {
    if (!provider) return ''
    return resolveProviderEndpoint(provider.url, getCustomProviderProtocol(provider))
}

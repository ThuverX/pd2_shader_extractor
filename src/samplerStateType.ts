export const D3DSAMPLERSTATETYPE = {
    D3DSAMP_ADDRESSU     : 1,
    D3DSAMP_ADDRESSV     : 2,
    D3DSAMP_ADDRESSW     : 3,
    D3DSAMP_BORDERCOLOR  : 4,
    D3DSAMP_MAGFILTER    : 5,
    D3DSAMP_MINFILTER    : 6,
    D3DSAMP_MIPFILTER    : 7,
    D3DSAMP_MIPMAPLODBIAS: 8,
    D3DSAMP_MAXMIPLEVEL  : 9,
    D3DSAMP_MAXANISOTROPY: 10,
    D3DSAMP_SRGBTEXTURE  : 11,
    D3DSAMP_ELEMENTINDEX : 12,
    D3DSAMP_DMAPOFFSET   : 13,
} as const

export function getSamplerStateTypeById(id: number): string | undefined {
    for(const [key, value] of Object.entries(D3DSAMPLERSTATETYPE)) {
        if(value === id) {
            return key
        }
    }
}

export function getSamplerStateIdByName(name: keyof typeof D3DSAMPLERSTATETYPE): number | undefined {
    return D3DSAMPLERSTATETYPE[name]
}
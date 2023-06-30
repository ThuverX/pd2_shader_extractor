import ByteBuffer from "bytebuffer"
import Long from "long"

type int = number
type long = Long

export interface ObjectHeader {
    type: int,
    ref_id: int,
    len: int,
    pos: int
}

export interface Object {
    header: ObjectHeader
}

export interface ObjectShader extends Object {
    passes: Map<long, Array<int>>
}

export interface ObjectShaderLibrary extends Object {
    render_templates: Map<long, int>
}

export interface StateVar {
    id: int,
    b: int,
    value4: int,
    value8: long
}

export interface SamplerState {
    id: int,
    vars: Array<StateVar>
}

export interface ObjectShaderPass extends Object {
    render_states: Array<StateVar>,
    sampler_states: Array<SamplerState>,
    vertex_shader: ByteBuffer,
    pixel_shader: ByteBuffer
}

export const OBJECT_TYPE_SHADER = 0x7F3552D1
export const OBJECT_TYPE_SHADER_PASS = 0x214b1aaf
export const OBJECT_TYPE_SHADER_LIBRARY = 0x12812C1A

export interface ShaderPackage {
    padding: int,
    count: int,
    headers: Array<ObjectHeader>,
    objects: Array<Object>
}

export function ReadObjectShader(bb: ByteBuffer, header: ObjectHeader): ObjectShader {
    bb.order(ByteBuffer.LITTLE_ENDIAN)

    const object_shader: ObjectShader = {
        header,
        passes: new Map()
    }

    let count = bb.readInt32()

    for (let i = 0; i < count; i++) {
        let id = bb.readInt64()
        let len = bb.readInt32()

        let passes: Array<int> = []

        for (let j = 0; j < len; j++) {
            let ref_id = bb.readInt32()
            passes[j] = ref_id
        }

        object_shader.passes.set(id, passes)
    }

    if (bb.remaining() > 0) {
        throw new Error(`ObjectShader: ${bb.remaining()} bytes remaining`)
    }

    return object_shader
}

export function ReadStateVar(bb: ByteBuffer): StateVar {
    bb.order(ByteBuffer.LITTLE_ENDIAN)

    const state_var: StateVar = {
        id: 0,
        b: 0,
        value4: 0,
        value8: Long.ZERO
    }

    state_var.id = bb.readInt32()
    state_var.b = bb.readInt8()

    if (state_var.b == 0) {
        state_var.value4 = bb.readInt32()
    } else {
        state_var.value8 = bb.readInt64()
    }

    return state_var
}

export function ReadSamplerState(bb: ByteBuffer): SamplerState {
    bb.order(ByteBuffer.LITTLE_ENDIAN)

    const sampler_state: SamplerState = {
        id: 0,
        vars: []
    }

    sampler_state.id = bb.readInt32()

    let count = bb.readInt32()

    for (let i = 0; i < count; i++) {
        sampler_state.vars.push(ReadStateVar(bb))
    }

    return sampler_state
}

export function ReadObjectShaderPass(bb: ByteBuffer, header: ObjectHeader): ObjectShaderPass {
    bb.order(ByteBuffer.LITTLE_ENDIAN)

    const object_shader_pass: ObjectShaderPass = {
        header,
        render_states: [],
        sampler_states: [],
        vertex_shader: ByteBuffer.allocate(0),
        pixel_shader: ByteBuffer.allocate(0)
    }

    let count = bb.readInt32()

    for (let i = 0; i < count; i++) {
        object_shader_pass.render_states.push(ReadStateVar(bb))
    }

    let sampler_count = bb.readInt32()

    for (let i = 0; i < sampler_count; i++) {
        object_shader_pass.sampler_states.push(ReadSamplerState(bb))
    }

    let vertex_shader_len = bb.readInt32()
    object_shader_pass.vertex_shader = bb.copy(bb.offset, bb.offset + vertex_shader_len)

    bb.offset += vertex_shader_len

    let pixel_shader_len = bb.readInt32()
    object_shader_pass.pixel_shader = bb.copy(bb.offset, bb.offset + pixel_shader_len)

    bb.offset += pixel_shader_len

    if (bb.remaining() > 0) {
        throw new Error(`ObjectShaderPass: ${bb.remaining()} bytes remaining`)
    }

    return object_shader_pass
}

export function ReadObjectShaderLibrary(bb: ByteBuffer, header: ObjectHeader): ObjectShaderLibrary {
    bb.order(ByteBuffer.LITTLE_ENDIAN)

    const object_shader_library: ObjectShaderLibrary = {
        header,
        render_templates: new Map()
    }

    let count = bb.readInt32()

    for (let i = 0; i < count; i++) {
        let id = bb.readInt64()
        let ref_id = bb.readInt32()

        object_shader_library.render_templates.set(id, ref_id)
    }

    if (bb.remaining() > 0) {
        throw new Error(`ObjectShaderLibrary: ${bb.remaining()} bytes remaining`)
    }

    return object_shader_library
}

export function ReadShaderPackage(bb: ByteBuffer): ShaderPackage {
    bb.order(ByteBuffer.LITTLE_ENDIAN)

    const shader_package: ShaderPackage = {
        padding: 0,
        count: 0,
        objects: [],
        headers: [],
    }

    shader_package.count = bb.readInt32()

    if (shader_package.count == -1) {
        shader_package.padding = bb.readInt32()
        shader_package.count = bb.readInt32()
    }

    for (let i = 0; i < shader_package.count; i++) {
        let type = bb.readInt32()

        if (type !== OBJECT_TYPE_SHADER && type !== OBJECT_TYPE_SHADER_PASS && type !== OBJECT_TYPE_SHADER_LIBRARY) {
            throw new Error(`Unknown object type ${type}`)
        }

        let ref_id = bb.readInt32()
        let len = bb.readInt32()
        let pos = bb.offset

        shader_package.headers.push({
            type,
            ref_id,
            len,
            pos
        })

        bb.offset = pos + len
    }

    for (let header of shader_package.headers) {
        let type = header.type

        let inner_bb = bb.copy(header.pos, header.pos + header.len)

        if (type === OBJECT_TYPE_SHADER) {
            shader_package.objects.push(ReadObjectShader(inner_bb, header))
        } else if (type === OBJECT_TYPE_SHADER_PASS) {
            shader_package.objects.push(ReadObjectShaderPass(inner_bb, header))
        } else if (type === OBJECT_TYPE_SHADER_LIBRARY) {
            shader_package.objects.push(ReadObjectShaderLibrary(inner_bb, header))
        }
    }

    return shader_package
}
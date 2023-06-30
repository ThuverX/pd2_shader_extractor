import Long from "long";
import { OBJECT_TYPE_SHADER_LIBRARY, ObjectShader, ObjectShaderLibrary, ObjectShaderPass, ShaderPackage } from "./shaderPackage";
import { lookup8 } from "./lookup8";
import { getStateTypeById } from "./renderStateType";
import { getSamplerStateTypeById } from "./samplerStateType";
import { DecompileShader } from "./decompiler";
import { readdir, unlink, writeFile, mkdir } from "fs/promises";
import { Worker } from 'worker_threads'
import ByteBuffer from "bytebuffer";
import { RenderTemplateDatabase } from "./renderTemplate";

export interface ExtractOptions {
    decompile?: boolean,
    threads?: number
}

export interface Info_Hash {
    id: Long,
    name: string
}

export interface Info_GameShader {
    type: 'ps_3_0' | 'vs_3_0',
    status: 'raw' | 'decompiled' | 'translated',
    code: string | ByteBuffer,
    error?: string,
    decompiler?: string
}

export interface Info_StateVar {
    name: string,
    value: number
}

export interface Info_SamplerState {
    id: number,
    vars: Array<Info_StateVar>
}

export interface Info_ShaderPass {
    render_states: Array<Info_StateVar>,
    sampler_states: Array<Info_SamplerState>,
    vertex_shader: Info_GameShader,
    pixel_shader: Info_GameShader
}

export interface Info_Shader {
    techniques: Map<Info_Hash, Array<Info_ShaderPass>>
}

export interface Info_ShaderLibrary {
    render_templates: Map<Info_Hash, Info_Shader>
}

let _options: Partial<ExtractOptions> = {}

const toBeCompiled = new Set<Info_ShaderPass>()

export async function clearTemp() {
    const dir = './temp'

    const files = await readdir(dir)

    for(const file of files) {
        await unlink(`${dir}/${file}`)
    }
}

export async function createTemp() {
    const dir = './temp'

    try {
        await readdir(dir)
    } catch(e) {
        await mkdir(dir)
    }
}

export async function DecompileAllShaders() {
    const promises = Array.from(toBeCompiled).map(async (shader_pass, idx) => {
        shader_pass.pixel_shader = await DecompileShader(shader_pass.pixel_shader.code as ByteBuffer, 'ps_3_0', idx)
        shader_pass.vertex_shader = await DecompileShader(shader_pass.vertex_shader.code as ByteBuffer, 'vs_3_0', idx)
    })

    console.time('decompileallshaders')

    await Promise.all(promises)

    console.timeEnd('decompileallshaders')
}

export async function DecompileAllShadersThreaded() {
    const chunks = Array.from(toBeCompiled).reduce((chunks, shader_pass, idx) => {
        const chunk_idx = idx % _options.threads!

        if(!chunks[chunk_idx]) {
            chunks[chunk_idx] = []
        }

        shader_pass.pixel_shader.code = (shader_pass.pixel_shader.code as ByteBuffer).toHex()
        shader_pass.vertex_shader.code = (shader_pass.vertex_shader.code as ByteBuffer).toHex()

        chunks[chunk_idx].push(shader_pass)

        return chunks
    }, {} as Record<number, Array<Info_ShaderPass>>)

    const promises = Object.values(chunks).map(async (chunk, idx) => {
        
        const worker = new Worker('./src/decompilerThreaded.js', {
            workerData: {
                chunk,
                idx,
                path: './decompilerThreaded.ts'
            }
        })
        
        console.log(`Starting thread ${idx}`)

        return new Promise<void>((res) => {
            worker.on('message', (message) => {
                if(message.type == 'done') {
                    for(let i = 0; i < message.chunk.length; i++) {
                        const shader_pass = message.chunk[i]

                        chunks[message.idx][i].pixel_shader = shader_pass.pixel_shader
                        chunks[message.idx][i].vertex_shader = shader_pass.vertex_shader
                    }

                    console.log(`Thread ${message.idx} done`)

                    res()
                }
            })
        })
    })

    console.time('decompileallshaders_threaded')

    await Promise.allSettled(promises)

    console.timeEnd('decompileallshaders_threaded')
}

const stringifyReplacer = (key: string, value: any) => {
    if(value instanceof Long) {
        return '0x' + value.toUnsigned().toString(16)
    }

    if(key == 'techniques' || key == 'render_templates') {
        return (Array.from(value.entries()) as any).map(([key, value]: [any,any]) => key.id?.toUnsigned ? [{
            id: '0x' + key.id.toUnsigned().toString(16),
            name: key.name
        }, value] : [key, value])
    }
    
    if(value instanceof ByteBuffer) {
        return value.toHex()
    }

    if(value instanceof Map) {
        return Array.from(value.entries())
    }

    return value
}


export async function ExtractShaderPackage(shader_package: ShaderPackage, output_path: string, options: ExtractOptions) {
    _options = options

    const shader_library = await CollectObjectShaderLibrary(shader_package)

    if(_options.decompile) {
        await createTemp()

        console.log(`Decompiling ${toBeCompiled.size} passes (${toBeCompiled.size * 2} shaders)`)

        if(_options.threads) {
            await DecompileAllShadersThreaded()
        } else {
            await DecompileAllShaders()
        }

        await clearTemp()
    }

    await writeFile(output_path, JSON.stringify(shader_library, stringifyReplacer, 4))
}

export function CollectHash(long: Long): Info_Hash {
    return {
        id: long,
        name: lookup8.lookup(long)
    }
}

export function GetByRefId<T>(shader_package: ShaderPackage, ref_id: number): T {
    for(let object of shader_package.objects) {
        if(object.header.ref_id == ref_id) {
            return object as T
        }
    }

    throw new Error("Object not found")
}

export async function CollectObjectShaderLibrary(shader_package: ShaderPackage): Promise<Info_ShaderLibrary> {
    let library: Info_ShaderLibrary = {
        render_templates: new Map()
    }

    let raw_templates = new Map<Long, number>()

    for(let object of shader_package.objects) {
        if(object.header.type == OBJECT_TYPE_SHADER_LIBRARY) {
            raw_templates = (object as ObjectShaderLibrary).render_templates
        }
    }

    for(let [name_hash, ref_id] of raw_templates) {
        let obj = GetByRefId<ObjectShader>(shader_package, ref_id)
        let info_hash = CollectHash(name_hash)

        library.render_templates.set(info_hash, await CollectObjectShader(obj, shader_package))
    }

    return library
}

export async function CollectObjectShaderPass(object: ObjectShaderPass, shader_package: ShaderPackage): Promise<Info_ShaderPass> {
    let pass: Info_ShaderPass = {
        render_states: new Array(),
        sampler_states: new Array(),
        vertex_shader: {} as Info_GameShader,
        pixel_shader: {} as Info_GameShader,
    }

    for(let state of object.render_states) {
        let name = getStateTypeById(state.id)!

        pass.render_states.push({
            name,
            value: state.value4
        })
    }

    for(let sampler of object.sampler_states) {
        let vars = new Array<Info_StateVar>()

        for(let state of sampler.vars) {
            let name = getSamplerStateTypeById(state.id)!

            vars.push({
                name,
                value: state.value4
            })
        }

        pass.sampler_states.push({
            id: sampler.id,
            vars
        })
    }

    pass.vertex_shader = {
        type: 'vs_3_0',
        status: 'raw',
        code: object.vertex_shader
    }

    pass.pixel_shader = {
        type: 'ps_3_0',
        status: 'raw',
        code: object.pixel_shader
    }

    if(_options.decompile) {
        toBeCompiled.add(pass)
    }

    return pass
}

export async function CollectObjectShader(object: ObjectShader, shader_package: ShaderPackage): Promise<Info_Shader> {
    let shader: Info_Shader = {
        techniques: new Map()
    }

    for(let [name_hash, arr] of object.passes) {
        let info_hash = CollectHash(name_hash)
        let passes = new Array<Info_ShaderPass>()
        for(let ref_id of arr) {
            let obj = GetByRefId<ObjectShaderPass>(shader_package, ref_id)

            passes.push(await CollectObjectShaderPass(obj, shader_package))
        }

        shader.techniques.set(info_hash, passes)
    }

    return shader
}

export async function ExtractRenderTemplates(render_template_databases: Map<string, RenderTemplateDatabase>, out_path: string) {
    await writeFile(out_path, JSON.stringify(render_template_databases, stringifyReplacer, 4))
}

export async function ExtractHashesFromRenderTemplates(render_template_databases: Map<string, RenderTemplateDatabase>, out_path: string) {
    const list: Set<string> = new Set()

    for(let [file_name, database] of render_template_databases) {
        for(let [name, template] of database.templates) {
            list.add(name)

            for(let input of template.inputs) {
                list.add(input.name)
                list.add(input.ui_name)
            }

            for(let [tech_name, tech] of template.techniques) {
                list.add(tech_name)

                for(let method of tech) {
                    list.add(method)
                }
            }
        }
    }

    await writeFile(out_path, [...list].join('\n'))
}
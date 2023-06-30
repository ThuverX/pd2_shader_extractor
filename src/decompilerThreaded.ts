import { workerData, parentPort } from "worker_threads"
import { Info_ShaderPass } from "./extractor"

const chunk = workerData.chunk as Array<Info_ShaderPass>
const idx = workerData.idx as number

import ByteBuffer from "bytebuffer";
import { Info_GameShader } from "./extractor";
import { writeFile } from 'fs/promises'
import { exec } from 'child_process'

import { decompiler_path } from "./decompiler";

;(async () => {
    const promises = chunk.map(async (shader_pass, idx) => {

        let pixelCode = ByteBuffer.fromHex(shader_pass.pixel_shader.code as string)
        let vertexCode = ByteBuffer.fromHex(shader_pass.vertex_shader.code as string)

        shader_pass.pixel_shader = await DecompileShader(pixelCode, 'ps_3_0', idx)
        shader_pass.vertex_shader = await DecompileShader(vertexCode, 'vs_3_0', idx)
    })

    await Promise.allSettled(promises)

    parentPort?.postMessage({
        type: 'done',
        idx,
        chunk
    })
})()

export function DecompileShader(bb: ByteBuffer, type: 'ps_3_0' | 'vs_3_0', index: number = 0): Promise<Info_GameShader> {
    return new Promise(async (res) => {

        const out_path = `./temp/shader_${idx}_${index}.o`

        await writeFile(out_path, bb.toBuffer())
    
        const command = `${decompiler_path} ${out_path}`

        exec(command, async (error, stdout, stderr) => {
            if(error) {
                res({
                    type,
                    code: bb.toHex(),
                    status: 'raw',
                    error: stderr,
                    decompiler: 'DXDecompiler'
                })
            }

            res({
                type,
                code: stdout,
                status: 'decompiled',
                decompiler: 'DXDecompiler'
            })
        })
    })
}
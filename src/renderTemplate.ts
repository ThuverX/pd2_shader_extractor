import { readFile, readdir } from "fs/promises"
import { XMLParser } from "fast-xml-parser"

export interface Input {
    name: string,
    type: string,
    ui_name: string
}

export interface RenderTemplate {
    techniques: Map<string, Array<string>>,
    inputs: Array<Input>
}

export interface RenderTemplateDatabase {
    templates: Map<string, RenderTemplate>
}

const render_template_folder_path = "./files/render_templates/"
const Parser = new XMLParser({
    allowBooleanAttributes: true,
    ignoreAttributes: false,
})

export async function ReadShaderInputs(obj: any): Promise<Array<Input>> {
    const inputs = []

    if(!Array.isArray(obj.variable)) {
        inputs.push({
            name: obj.variable['@_name'],
            type: obj.variable['@_type'],
            ui_name: obj.variable['@_ui_name']
        })
    } else {
        for(let input of obj.variable) {
            inputs.push({
                name: input['@_name'],
                type: input['@_type'],
                ui_name: input['@_ui_name']
            })
        }
    }


    return inputs
}

export async function ReadMethod(obj: any): Promise<string> {
    return obj['@_name']
}

export async function ReadShaderTechniques(obj: any): Promise<Map<string, Array<string>>> {
    const techniques = new Map<string, Array<string>>()

    if(!Array.isArray(obj)) {
        if(!Array.isArray(obj.method)) {
            techniques.set(obj['@_name'], [await ReadMethod(obj.method)])
        } else {
            let methods = []
            for(let method of obj.method) {
                methods.push(await ReadMethod(method))
            }
            techniques.set(obj['@_name'], methods)
        }
    } else {
        for(let technique of obj) {
            if(!Array.isArray(technique.method)) {
                techniques.set(technique['@_name'], [await ReadMethod(technique.method)])
            } else {
                let methods = []
                for(let method of technique.method) {
                    methods.push(await ReadMethod(method))
                }
                techniques.set(technique['@_name'], methods)
            }
        }
    }


    return techniques
}

export async function ReadRenderTemplate(obj: any): Promise<RenderTemplate> {
    const renderTemplate: RenderTemplate = {
        techniques: new Map<string, Array<string>>(),
        inputs: []
    }

    if(obj.shader_input_declaration) {
        renderTemplate.inputs = await ReadShaderInputs(obj.shader_input_declaration)
    }

    if(obj.technique) {
        renderTemplate.techniques = await ReadShaderTechniques(obj.technique)
    }

    return renderTemplate
}

export async function ReadRenderTemplateDatabase(content: string): Promise<RenderTemplateDatabase> {
    const obj = Parser.parse(content)

    const renderTemplateDatabase = {
        templates: new Map<string, RenderTemplate>()
    }

    for(let template of obj.diesel_render_system.render_templates.template) {
        renderTemplateDatabase.templates.set(template['@_name'], await ReadRenderTemplate(template))
    }

    return renderTemplateDatabase
}

export async function ReadAllRenderTemplateDatases(): Promise<Map<string, RenderTemplateDatabase>> {
    const files = await readdir(render_template_folder_path)

    const databases = new Map<string, RenderTemplateDatabase>()

    for(const file of files) {
        const content = await readFile(render_template_folder_path + file, 'utf-8')

        const database = await ReadRenderTemplateDatabase(content)

        databases.set(file, database)
    }

    return databases
}
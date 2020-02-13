import path from 'path';
import { OutputTargetVue } from './types';
import { dashToPascalCase, normalizePath, sortBy } from './utils';
import { CompilerCtx, ComponentCompilerMeta } from '@stencil/core/internal';
import { generateComponent } from './generate-vue-component';
import { ComponentCompilerEvent } from '@stencil/core/dist/declarations';

export async function vueProxyOutput(
  compilerCtx: CompilerCtx,
  outputTarget: OutputTargetVue,
  components: ComponentCompilerMeta[]
) {
  const filteredComponents = getFilteredComponents(outputTarget.excludeComponents, components);

  await generateProxies(compilerCtx, filteredComponents, outputTarget);
}

function getFilteredComponents(excludeComponents: string[] = [], cmps: ComponentCompilerMeta[]) {
  return sortBy(cmps, cmp => cmp.tagName).filter(
    c => !excludeComponents.includes(c.tagName) && !c.internal,
  );
}

async function generateProxies(
  compilerCtx: CompilerCtx,
  components: ComponentCompilerMeta[],
  outputTarget: OutputTargetVue
) {
  const header = `/* eslint-disable */
/* tslint:disable */
/* auto-generated vue proxies */\n`;

  const sourceImports = `import { ${REGISTER_CUSTOM_ELEMENTS}, ${APPLY_POLYFILLS} } from '${normalizePath(
    path.join(
      outputTarget.componentCorePackage || '',
      outputTarget.loaderDir || DEFAULT_LOADER_DIR,
    ),
  )}';\n`;

  const registerCustomElements = `${APPLY_POLYFILLS}().then(() => ${REGISTER_CUSTOM_ELEMENTS}(window));`;

  const componentReferences: string[] = [...components.map(createComponentReference)];
  await Promise.all(
    components.map((component: ComponentCompilerMeta): Promise<void> => new Promise((resolve, reject) => {
      try {
        const model = findModel(outputTarget.modelConfigs, component.events);
        const vueComponent = [
          '/* eslint-disable */',
          '/* tslint:disable */',
          '/* auto-generated vue components */',
          `import '${outputTarget.componentCorePackage}';`,
          ...generateComponent(component, model)
        ].join(`\n`);
        const componentPath = getComponentPath(outputTarget.proxiesFile, component);
        compilerCtx.fs.writeFile(componentPath, vueComponent). then(() => { resolve(); });
      } catch (err) {
        console.warn(err);
      }
    }))
  );

  const final: string[] = [
    header,
    sourceImports,
    registerCustomElements,
    componentReferences.join('\n')
  ];

  const finalText = final.join('\n') + '\n';

  return compilerCtx.fs.writeFile(outputTarget.proxiesFile, finalText);
}

function createComponentReference(cmpMeta: ComponentCompilerMeta) {
  const tagNameAsPascal = dashToPascalCase(cmpMeta.tagName);

  return `export { default as ${tagNameAsPascal} } from "./components/${tagNameAsPascal}";`;
}

function getComponentPath(proxiesFile: string, component: ComponentCompilerMeta): string {
  const tagNameAsPascal = dashToPascalCase(component.tagName);
  const fileName = tagNameAsPascal + COMPONENT_EXTENSION;
  return normalizePath(path.join(
    proxiesFile,
    '../',
    COMPONENTS_DIR,
    fileName
  ));
}

function findModel(models: {[key: string]: string}, events: ComponentCompilerEvent[]): { eventName: string, propName: string} | undefined {
  const model = events.find((e) => !!models[e.name]);
  return model && { eventName: model.name, propName: models[model.name] } || undefined;
}

const REGISTER_CUSTOM_ELEMENTS = 'defineCustomElements';
const APPLY_POLYFILLS = 'applyPolyfills';
const DEFAULT_LOADER_DIR = '/loader';
const COMPONENTS_DIR = '/components';
const COMPONENT_EXTENSION = '.ts';

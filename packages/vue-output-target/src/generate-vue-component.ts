import { ComponentCompilerMeta } from '@stencil/core/internal';
import { dashToPascalCase, getPropType, indentLines } from './utils';
import { ComponentCompilerEvent, ComponentCompilerMethod, ComponentCompilerProperty } from '@stencil/core/dist/declarations';

const REF_NAME = 'childWebComponent';
const EVENT_PREFIX = 'on_';

export function generateComponent(component: ComponentCompilerMeta, models?: { eventName: string, propName: string}): string[] {
  const componentName = dashToPascalCase(component.tagName);
  const model: string[] = models && defineModel(component, models) || [];
  const props: string[] = defineProps(component.properties.filter(prop => models && prop.name !== models.propName));
  return [
    'import "reflect-metadata";',
    'import { VNode } from "vue";',
    `import { Vue, Component, Ref, ${!!props.length && 'Prop' || ''}, ${!!model.length && 'Model' || ''} } from 'vue-property-decorator';`,
    '',
    '@Component',
    `export default class ${componentName} extends Vue {`,
    ...indentLines([
      ...model,
      ...defineRef(componentName),
      ...props,
      ...defineMethods(component.methods),
      ...defineEvents(component.events),
      ...defineRender(component)
    ]),
    '};',
    ''
  ];
}

function defineEvents(events: ComponentCompilerEvent[]): string[] {
  return [
    ...events.map(event => {
      return `${EVENT_PREFIX + event.name}(eventValue: any) { this.$emit("${event.name}", eventValue); }`;
    })
  ];
}

function defineModel(component: ComponentCompilerMeta, models: { eventName: string, propName: string }): string[] {
  const prop: ComponentCompilerProperty | undefined = component.properties.find(p => p.name === models.propName);
  const event: ComponentCompilerEvent | undefined = component.events.find(e => e.name === models.eventName);
  if (!prop || !event) return [];

  const propType = getPropType(prop);
  return [
    `@Model("${event.name}") readonly ${prop.name}: ${propType}`
  ];
}

function defineRef(componentName: string): string[] {
  return [`@Ref() readonly ${REF_NAME}!: HTML${componentName}Element`];
}

function defineRender(component: ComponentCompilerMeta): string[] {
  return [
    'render (createElement: any): VNode {',
    ...indentLines([
      `return createElement("${component.tagName}",`,
      ...indentLines([
        '{',
        ...indentLines([
          `ref: "${REF_NAME}",`,
          'props: {',
          ...indentLines([
            ...component.properties.map(prop => {
              return `${prop.name}: this.${prop.name},`;
            })
          ]),
          '},',
          'nativeOn: {',
          ...indentLines([
            ...component.events.map(event => {
              return `${event.name}: this.${EVENT_PREFIX + event.name},`;
            })
          ]),
          '}'
        ]),
        '},',
        '[this.$slots.default]'
      ]),
      ');'
    ]),
    '}'
  ];
}

function defineProps(properties: ComponentCompilerProperty[]): string[] {
  return properties.map(prop => {
    const propType = getPropType(prop);
    return `@Prop() readonly ${prop.name}: ${propType}`;
  });
}

function defineMethods(methods: ComponentCompilerMethod[]): string[] {
  return methods.map(method => {
    return `get ${method.name}() { return this.$refs["${REF_NAME}"].${method.name} }`;
  });
}

export default generateComponent;

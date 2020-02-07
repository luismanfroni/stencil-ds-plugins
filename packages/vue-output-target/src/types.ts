import { CompilerJsDoc } from '@stencil/core/dist/declarations';
export interface OutputTargetVue {
  componentCorePackage?: string;
  proxiesFile: string;
  excludeComponents?: string[];
  loaderDir?: string;
  modelConfig: {
    [key: string]: string
  };
}
export interface PackageJSON {
  types: string;
}
export interface DocummentedObject {
  docs: CompilerJsDoc;
}

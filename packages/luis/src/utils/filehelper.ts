import {CLIError, utils} from '@microsoft/bf-cli-command'
const fs = require('fs-extra')
const path = require('path')
const helpers = require('./../parser/lufile/helpers')
const luObject = require('./../parser/lufile/classes/luObject')

/* tslint:disable:prefer-for-of no-unused*/

export async function getLuObjects(stdin: string, input: string | undefined, recurse = false, extType: string | undefined) {
  let luObjects: any = []
  if (stdin) {
    luObjects.push(new luObject('stdin', stdin))
  } else {
    let luFiles = await getLuFiles(input, recurse, extType)
    for (let i = 0; i < luFiles.length; i++) {
      let luContent = await getContentFromFile(luFiles[i])
      luObjects.push(new luObject(path.resolve(luFiles[i]), luContent))
    }
  }

  return luObjects
}

async function getLuFiles(input: string | undefined, recurse = false, extType: string | undefined): Promise<Array<any>> {
  let filesToParse = []
  let fileStat = await fs.stat(input)
  if (fileStat.isFile()) {
    filesToParse.push(input)
    return filesToParse
  }

  if (!fileStat.isDirectory()) {
    throw new CLIError('Sorry, ' + input + ' is not a folder or does not exist')
  }

  filesToParse = helpers.findLUFiles(input, recurse, extType)

  if (filesToParse.length === 0) {
    throw new CLIError(`Sorry, no ${extType} files found in the specified folder.`)
  }
  return filesToParse
}

export async function getContentFromFile(file: string) {
  // catch if input file is a folder
  if (fs.lstatSync(file).isDirectory()) {
    throw new CLIError('Sorry, "' + file + '" is a directory! Unable to read as a file')
  }
  if (!fs.existsSync(path.resolve(file))) {
    throw new CLIError('Sorry [' + file + '] does not exist')
  }
  let fileContent
  try {
    fileContent = await utils.readTextFile(file)
  } catch (err) {
    throw new CLIError('Sorry, error reading file: ' + file)
  }
  return fileContent
}

export async function generateNewFilePath(outFileName: string, inputfile: string, isLu: boolean, prefix = '', extType: string = helpers.FileExtTypeEnum.LUFile): Promise<string> {
  let base = path.resolve(outFileName)
  let extension = path.extname(base)
  if (extension) {
    let root = path.dirname(base)
    let file = path.basename(base)
    return path.join(root, prefix + file)
  }

  let name = ''
  let inputStat = await fs.stat(inputfile)
  if (inputStat.isFile()) {
    name += path.basename(inputfile, path.extname(inputfile)) + (isLu ? '.json' : extType)
  } else {
    name += isLu ? 'converted.json' : `converted.${extType}`
  }
  return path.join(base, prefix + name)
}

export async function generateNewTranslatedFilePath(fileName: string, translatedLanguage: string, output: string): Promise<string> {
  let newPath = path.resolve(output)
  newPath = path.join(output, translatedLanguage)
  await fs.mkdirp(newPath)
  return path.join(newPath, fileName)
}

export function validatePath(outputPath: string, defaultFileName: string, forceWrite = false): string {
  let completePath = path.resolve(outputPath)
  const containingDir = path.dirname(completePath)

  // If the cointaining folder doesnt exist
  if (!fs.existsSync(containingDir)) throw new CLIError(`Containing directory path doesn't exist: ${containingDir}`)

  const baseElement = path.basename(completePath)
  const pathAlreadyExist = fs.existsSync(completePath)

  // If the last element in the path is a file
  if (baseElement.includes('.')) {
    return pathAlreadyExist && !forceWrite ? enumerateFileName(completePath) : completePath
  }

  // If the last element in the path is a folder
  if (!pathAlreadyExist) throw new CLIError(`Target directory path doesn't exist: ${completePath}`)
  completePath = path.join(completePath, defaultFileName)
  return fs.existsSync(completePath) && !forceWrite ? enumerateFileName(completePath) : completePath
}

function enumerateFileName(filePath: string): string {
  const fileName = path.basename(filePath)
  const containingDir = path.dirname(filePath)

  if (!fs.existsSync(containingDir)) throw new CLIError(`Containing directory path doesn't exist: ${containingDir}`)

  const extension = path.extname(fileName)
  const baseName = path.basename(fileName, extension)
  let nextNumber = 0
  let newPath = ''

  do {
    newPath = path.join(containingDir, baseName + `(${++nextNumber})` + extension)
  } while (fs.existsSync(newPath))

  return newPath
}

export async function detectLuContent(stdin: string, input: string) {
  if (!stdin && !input) {
    throw new CLIError('Missing input. Please use stdin or pass a file location with --in flag')
  }

  if (!stdin) {
    if (!fs.existsSync(path.resolve(input))) {
      throw new CLIError(`Sorry unable to open [${input}]`)
    }

    let inputStat = await fs.stat(input)
    return !inputStat.isFile() ? true : (path.extname(input) === '.lu' || path.extname(input) === '.qna')
  }

  try {
    await JSON.parse(stdin)
  } catch (error) {
    return true
  }
  return false
}

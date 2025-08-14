import { getVersion } from '../getVersion.js'
import { readFileSync } from 'fs'

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}))

describe('getVersion', () => {
  const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('should return version from package.json', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }))
    
    const result = getVersion()
    
    expect(result).toBe('1.2.3')
    expect(mockReadFileSync).toHaveBeenCalled()
  })

  it('should return default version if version is not in package.json', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({}))
    
    const result = getVersion()
    
    expect(result).toBe('1.0.0')
    expect(mockReadFileSync).toHaveBeenCalled()
  })

  it('should return "unknown" if reading package.json fails', () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('File not found')
    })
    
    const result = getVersion()
    
    expect(result).toBe('unknown')
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(mockReadFileSync).toHaveBeenCalled()
  })

  it('should return "unknown" if parsing package.json fails', () => {
    mockReadFileSync.mockReturnValue('invalid json')
    
    const result = getVersion()
    
    expect(result).toBe('unknown')
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(mockReadFileSync).toHaveBeenCalled()
  })
})


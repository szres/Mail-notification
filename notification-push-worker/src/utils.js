export const log = {
    info: (...args) => console.log(new Date().toISOString(), ...args),
    error: (...args) => console.error(new Date().toISOString(), ...args),
    debug: (...args) => console.debug(new Date().toISOString(), ...args),
    warn: (...args) => console.warn(new Date().toISOString(), ...args),
}; 
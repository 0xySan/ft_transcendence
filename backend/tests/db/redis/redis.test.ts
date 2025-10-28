import { setValue, getValue, checkRedisHealth, redisClient, hsetValue, hgetAllValues, hgetValue } from '../../../src/redis/index.js';
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe('Redis Client', () => {

    beforeAll(async () => {
        if (!redisClient.connected && redisClient.connect) {
        await redisClient.connect?.();
        }
    });

    afterAll(async () => {
        await redisClient.quit?.();
    });

    it('should set and get a value', async () => {
        await setValue('testKey', 'testValue');
        expect(await getValue('testKey')).toBe('testValue');
    });

    it('should hsetValue and get all fields', async () => {
        const hashKey = 'user:multi';
        await hsetValue(hashKey, { test: 'A', lala: 'B', lolo: 'C' });

        const result = await hgetAllValues(hashKey);
        expect(result).toEqual({ test: 'A', lala: 'B', lolo: 'C' });
    });

    it('should hsetValue one field and get it with hgetValue', async () => {
        const hashKey = 'user:single';
        await hsetValue(hashKey, 'name', 'Alice');

        const value = await hgetValue(hashKey, 'name');
        expect(value).toBe('Alice');
    });

    it('should pass health check', async () => {
        expect(await checkRedisHealth()).toBe(true);
    });
});
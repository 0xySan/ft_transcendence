// src/redis/index.js
import { createClient as createRealClient } from 'redis';
import redisMock from 'redis-mock';

const isTest = process.env.NODE_ENV === 'test';

export const redisClient = isTest
  ? redisMock.createClient()
  : createRealClient({ url: 'redis://localhost:6379' });

redisClient.on('error', (err: any) => console.log('Redis Client Error', err));

function promisifyRedisMethod(fn: any, ...args: any) {
    return new Promise((resolve, reject) => {
        fn.call(redisClient, ...args, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
        });
    });
}

export const hsetValue = async (hashKey: any, fieldOrObject: any, value?: string) => {
    if (typeof fieldOrObject === 'object') {
        if (isTest) return promisifyRedisMethod(redisClient.hmset, hashKey, fieldOrObject);
        return redisClient.hSet(hashKey, fieldOrObject);
    } else {
        if (isTest) return promisifyRedisMethod(redisClient.hset, hashKey, fieldOrObject, value);
        return redisClient.hSet(hashKey, fieldOrObject, value);
    }
};

export const hgetAllValues = async (hashKey: any) => {
    if (isTest) return promisifyRedisMethod(redisClient.hgetall, hashKey);
    return redisClient.hGetAll(hashKey);
};

export const hgetValue = async (hashKey: string, field: any) => {
    if (isTest) return promisifyRedisMethod(redisClient.hget, hashKey, field);
    return redisClient.hGet(hashKey, field);
};

export const setValue = async (key: any, value: any) => {
    if (isTest) return promisifyRedisMethod(redisClient.set, key, value);
    return redisClient.set(key, value);
};

export const getValue = async (key: any) => {
    if (isTest) return promisifyRedisMethod(redisClient.get, key);
    return redisClient.get(key);
};

export const checkRedisHealth = async () => {
    try {
        await setValue('health', 'ok');
        const reply = await getValue('health');
        return reply === 'ok';
    } catch (error) {
        console.error('Redis Health Check Failed:', error);
        return false;
    }
};

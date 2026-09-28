package com.sky.cache;

import com.sky.context.BaseContext;
import com.sky.entity.ShoppingCart;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Service
public class CacheService {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;
    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private static final String CART_KEY_PREFIX = "cart:user:";
    // 防穿透专用的空标记
    private static final String EMPTY_CART_FLAG = "EMPTY_CART_FLAG";

    private static final String EMPTY_FLAG_VALUE = "EMPTY";

    public void clearCategoryCache() {
        // 清理分类缓存
        Set<String> categoryKeys = stringRedisTemplate.keys("category_*");
        if (categoryKeys != null && !categoryKeys.isEmpty()) {
            stringRedisTemplate.delete(categoryKeys);
        }

        // 顺便把菜品缓存也清了（防止分类改名后，菜品列表还是旧的）
        Set<String> dishKeys = stringRedisTemplate.keys("dish_*");
        if (dishKeys != null && !dishKeys.isEmpty()) {
            stringRedisTemplate.delete(dishKeys);
        }
        //删套餐
        Set<String> setmealKeys = stringRedisTemplate.keys("setmeal_*");
        if (setmealKeys != null && !setmealKeys.isEmpty()) {
            stringRedisTemplate.delete(setmealKeys);
        }
    }

//清空套餐
    @CacheEvict(value = "setmeal", allEntries = true)
    public void setmealEvictAll() {}

//    清空整个购物车
    public void cleanShoppingCart(Long userId) {
        String key = CART_KEY_PREFIX + userId;
        redisTemplate.delete(key);
    }

//    精准删除缓存中的某个商品（用于 subShoppingCart 数量为1时删除记录）
    public void cleanShoppingCartItem(Long userId, Long dishId, Long setmealId) {
        // 1. 防御性校验：如果两个 ID 都为空，说明传参有误，直接拦截
        if (dishId == null && setmealId == null) {
            throw new IllegalArgumentException("商品ID不能同时为空");
        }

        // 2. 拼接 Redis 的大 Key
        String key = CART_KEY_PREFIX + userId;

        // 3. 动态拼接唯一的 Field（小 Key）
        // 谁不为空，就用谁拼接
        String field;
        if (dishId != null) {
            field = "dish_" + dishId;
        } else {
            field = "setmeal_" + setmealId;
        }

        // 4. 获取 Hash 操作对象并精准删除
        HashOperations<String, Object, Object> hashOperations = redisTemplate.opsForHash();
        hashOperations.delete(key, field);
    }
//todo防雪崩
    /**
     * 添加商品到购物车 (包含防雪崩策略)
     */
    public void addCart(ShoppingCart cart) {
        Long userId = cart.getUserId();
        String key = CART_KEY_PREFIX + userId;

        // 拼接 Field
        String field;
        if (cart.getDishId() != null) {
            field = "dish_" + cart.getDishId();
        } else {
            field = "setmeal_" + cart.getSetmealId();
        }

        // 直接将整个对象存入 Hash
        HashOperations<String, Object, Object> hashOperations = redisTemplate.opsForHash();
        // 添加商品说明购物车已非空，先移除防穿透空标记，避免标记与商品共存
        hashOperations.delete(key, EMPTY_CART_FLAG);
        hashOperations.put(key, field, cart);

        // 【防雪崩】：每次写入或更新时，刷新过期时间并加上随机值
        // 基础30分钟 + 随机0~5分钟，防止大批量购物车在同一秒集体过期
        int randomTime = new Random().nextInt(5);
        redisTemplate.expire(key, 30 + randomTime, TimeUnit.MINUTES);
    }

//todo防雪崩
    /**
     * 更新购物车中商品的数量 (包含防雪崩策略)
     */
    public void updateCartItemNumber(ShoppingCart shoppingCart) {
        Long userId = shoppingCart.getUserId();
        String key = CART_KEY_PREFIX + userId;

        String field;
        if (shoppingCart.getDishId() != null) {
            field = "dish_" + shoppingCart.getDishId();
        } else {
            field = "setmeal_" + shoppingCart.getSetmealId();
        }

        HashOperations<String, Object, Object> hashOperations = redisTemplate.opsForHash();
        // 直接存入最新的对象（包含修改后的 number），无需先 get
        hashOperations.put(key, field, shoppingCart);

        // 【防雪崩】：同样加上随机过期时间
        int randomTime = new Random().nextInt(5);
        redisTemplate.expire(key, 30 + randomTime, TimeUnit.MINUTES);
    }
//todo购物车查询（包含防穿透策略）
    /**
     * 【防穿透】：当数据库查出来用户购物车为空时，存入空标记
     */
    public void setEmptyCartFlag(Long userId) {
        String key = CART_KEY_PREFIX + userId;
        HashOperations<String, Object, Object> hashOperations = redisTemplate.opsForHash();
        // 存入一个特殊的标记
        hashOperations.put(key, EMPTY_CART_FLAG, "true");
        long randomSeconds = ThreadLocalRandom.current().nextInt(31);
        // 空标记的过期时间要短一点，比如 5 分钟，防止长期占用内存
        redisTemplate.expire(key, 30+randomSeconds, TimeUnit.SECONDS);
    }

    /**
     * 【防穿透】：判断缓存中是否只有空标记
     */
    public boolean isEmptyCartFlag(Map<Object, Object> entries) {
        if (entries == null || entries.isEmpty()) {
            return false;
        }
        // 如果 Hash 里只有 1 个元素，并且它的 key 是空标记，说明这是防穿透的占位符
        return entries.size() == 1 && entries.containsKey(EMPTY_CART_FLAG);
    }

    /**
     * 判断 Hash 的某个 field 是否为空标记字段
     * 用于读取购物车时过滤掉与商品共存的历史脏标记
     */
    public boolean isCartFlagField(Object field) {
        return EMPTY_CART_FLAG.equals(field);
    }



//    value是普通数据 分类、菜品、套餐通用
    /**
     * 【防穿透】存入空标记
     *
     * @param key 完整的 Redis Key (注意：调用时必须带上业务前缀，如 "category:1001")
     */
    public void setEmptyFlag(String key) {

        int timeout = ThreadLocalRandom.current().nextInt(31);

        // 存入我们约定的 "EMPTY" 字符串
        stringRedisTemplate.opsForValue().set(key, EMPTY_FLAG_VALUE, 60+timeout, TimeUnit.SECONDS);
    }

    /**
     * 【防穿透】判断是否为空标记
     *
     * @param value 从 Redis 中获取到的原始值
     * @return true 表示是空标记(数据库没数据)，false 表示是正常数据或 null
     */
    public boolean isEmptyFlag(Object value) {
        // 如果查出来是 null，说明连空标记都没存过（可能是第一次查，或者过期了）
        if (value == null) {
            return false;
        }
        // 判断值是否等于我们要的 "EMPTY"
        return EMPTY_FLAG_VALUE.equals(value.toString());
    }
}

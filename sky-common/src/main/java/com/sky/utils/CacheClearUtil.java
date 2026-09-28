//package com.sky.utils;
//
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.data.redis.core.StringRedisTemplate;
//import org.springframework.stereotype.Component;
//
//import java.util.Set;
//
//@Component
//public class CacheClearUtil {
//    @Autowired
//    private StringRedisTemplate stringRedisTemplate;
//
//    public void clearCategoryCache() {
//        // 清理分类缓存
//        Set<String> categoryKeys = stringRedisTemplate.keys("category_*");
//        if (categoryKeys != null && !categoryKeys.isEmpty()) {
//            stringRedisTemplate.delete(categoryKeys);
//        }
//
//        // 顺便把菜品缓存也清了（防止分类改名后，菜品列表还是旧的）
//        Set<String> dishKeys = stringRedisTemplate.keys("dish_*");
//        if (dishKeys != null && !dishKeys.isEmpty()) {
//            stringRedisTemplate.delete(dishKeys);
//        }
//        //删套餐
//        Set<String> setmealKeys = stringRedisTemplate.keys("setmeal_*");
//        if (setmealKeys != null && !setmealKeys.isEmpty()) {
//            stringRedisTemplate.delete(setmealKeys);
//        }
//}

package com.sky.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sky.cache.CacheService;
import com.sky.context.BaseContext;
import com.sky.dto.ShoppingCartDTO;
import com.sky.entity.Dish;
import com.sky.entity.Setmeal;
import com.sky.entity.ShoppingCart;
import com.sky.mapper.DishMapper;
import com.sky.mapper.SetmealMapper;
import com.sky.mapper.ShoppingCartMapper;
import com.sky.service.ShoppingCartService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.beans.beancontext.BeanContext;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

//缓存问题已解决
@Service
@Slf4j
public class ShoppingCartServiceImpl implements ShoppingCartService {

    @Autowired
    private ShoppingCartMapper shoppingCartMapper;
    @Autowired
    private DishMapper dishMapper;
    @Autowired
    private SetmealMapper setmealMapper;
    @Qualifier("redisTemplate")
    @Resource
    private RedisTemplate<String,Object> redisTemplate;
    @Autowired
    private CacheService  cacheService;
    @Autowired
    private ObjectMapper objectMapper;


    /**
     * 添加购物车
     * @param shoppingCartDTO
     */
    public void addShoppingCart(ShoppingCartDTO shoppingCartDTO) {
        //判断当前加入到购物车中的商品是否已经存在了
        ShoppingCart shoppingCart = new ShoppingCart();
        BeanUtils.copyProperties(shoppingCartDTO,shoppingCart);
        Long userId = BaseContext.getCurrentId();
        shoppingCart.setUserId(userId);

        List<ShoppingCart> list = shoppingCartMapper.list(shoppingCart);

        //如果已经存在了，只需要将数量加一
        if(list != null && list.size() > 0){
            ShoppingCart cart = list.get(0);
            cart.setNumber(cart.getNumber() + 1);//update shopping_cart set number = ? where id = ?
            shoppingCartMapper.updateNumberById(cart);
            cacheService.updateCartItemNumber(cart);

        }else {
            //如果不存在，需要插入一条购物车数据
            //判断本次添加到购物车的是菜品还是套餐
            Long dishId = shoppingCartDTO.getDishId();
            if(dishId != null){
                //本次添加到购物车的是菜品
                Dish dish = dishMapper.getById(dishId);
                shoppingCart.setName(dish.getName());
                shoppingCart.setImage(dish.getImage());
                shoppingCart.setAmount(dish.getPrice());
            }else{
                //本次添加到购物车的是套餐
                Long setmealId = shoppingCartDTO.getSetmealId();
                Setmeal setmeal = setmealMapper.getById(setmealId);
                shoppingCart.setName(setmeal.getName());
                shoppingCart.setImage(setmeal.getImage());
                shoppingCart.setAmount(setmeal.getPrice());
            }
            shoppingCart.setNumber(1);
            shoppingCart.setCreateTime(LocalDateTime.now());
            shoppingCartMapper.insert(shoppingCart);
            cacheService.addCart(shoppingCart);
        }
    }

    /**
     * 查看购物车
     * @return
     */
//    redis已完成
    public List<ShoppingCart> showShoppingCart() {
        Long userId = BaseContext.getCurrentId();
        String redisKey = "cart:user:" + userId;
        List<ShoppingCart> cartList;

        // 1. 从 Redis 获取数据 (使用 Hash 获取所有字段)
        Map<Object, Object> entries = redisTemplate.opsForHash().entries(redisKey);
//        todo防穿透
        // 如果判断出这是一个空标记，直接返回空集合，绝对不去查数据库！
        if (cacheService.isEmptyCartFlag(entries)) {
            return Collections.emptyList();
        }
        // 2. 缓存未命中，查数据库并回写缓存
        if (entries == null || entries.isEmpty()) {
            ShoppingCart queryCart = ShoppingCart.builder().userId(userId).build();
            cartList = shoppingCartMapper.list(queryCart);

            if (cartList != null && !cartList.isEmpty()) {
                // 将 List 转换成 Map 存入 Redis Hash
                Map<String, ShoppingCart> map = new HashMap<>();
                for (ShoppingCart cart : cartList) {
                    // 组合唯一 Field，区分单品和套餐
                    String field = (cart.getDishId() != null ? "dish_" : "setmeal_") +
                            (cart.getDishId() != null ? cart.getDishId() : cart.getSetmealId());
                    map.put(field, cart);
                }
                redisTemplate.opsForHash().putAll(redisKey, map);
                // todo【防雪崩】：基础时间 + 随机时间
                long randomSeconds = ThreadLocalRandom.current().nextInt(121);
                redisTemplate.expire(redisKey, 1800 + randomSeconds, TimeUnit.SECONDS);
            } else {
                // todo：数据库也没数据，存入空标记（防穿透）
                cacheService.setEmptyCartFlag(userId);
            }
        } else {

            // 1. 获取 values 集合
            Collection<Object> values = entries.values();

// TODO 使用 Stream 进行类型转换

            cartList = entries.entrySet().stream()
                    // 过滤防穿透空标记，避免将字符串 "true" 反序列化为 ShoppingCart
                    .filter(entry -> !cacheService.isCartFlagField(entry.getKey()))
                    .map(entry -> objectMapper.convertValue(entry.getValue(), ShoppingCart.class))
                    .collect(Collectors.toList());

//            错误示范强转会报错
//            cartList = values.stream()
//                    .map(value -> (ShoppingCart) value) // 强转为 ShoppingCart
//                    .collect(Collectors.toList()); // 收集成新的 List
        }
        return cartList != null ? cartList : Collections.emptyList();
    }

    /**
     * 清空购物车
     */
//    redis已经完成
    public void cleanShoppingCart() {
        //获取到当前微信用户的id
        Long userId = BaseContext.getCurrentId();
        shoppingCartMapper.deleteByUserId(userId);
        cacheService.cleanShoppingCart(userId);
    }

    /**
     * 删除购物车中一个商品
     * @param shoppingCartDTO
     */
//    Todo重点
//    redis已完成
    public void subShoppingCart(ShoppingCartDTO shoppingCartDTO) {
        ShoppingCart shoppingCart = new ShoppingCart();
        BeanUtils.copyProperties(shoppingCartDTO,shoppingCart);
        //设置查询条件，查询当前登录用户的购物车数据
        Long currentId = BaseContext.getCurrentId();
        shoppingCart.setUserId(currentId);

        List<ShoppingCart> list = shoppingCartMapper.list(shoppingCart);

        if(list != null && list.size() > 0){
            shoppingCart = list.get(0);

            Integer number = shoppingCart.getNumber();
            if(number == 1){
                //当前商品在购物车中的份数为1，直接删除当前记录
                shoppingCartMapper.deleteById(shoppingCart.getId());
                cacheService.cleanShoppingCartItem(
                        shoppingCart.getUserId(),
                        shoppingCart.getDishId(),
                        shoppingCart.getSetmealId()
                );

            }else {
                //当前商品在购物车中的份数不为1，修改份数即可
                shoppingCart.setNumber(shoppingCart.getNumber() - 1);
                shoppingCartMapper.updateNumberById(shoppingCart);
                cacheService.updateCartItemNumber(shoppingCart);
            }
        }

    }
}

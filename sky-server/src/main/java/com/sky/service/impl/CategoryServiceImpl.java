package com.sky.service.impl;

import com.alibaba.fastjson.JSON;
import com.github.pagehelper.Page;
import com.github.pagehelper.PageHelper;
import com.sky.cache.CacheService;
import com.sky.constant.MessageConstant;
import com.sky.constant.StatusConstant;
import com.sky.context.BaseContext;
import com.sky.dto.CategoryDTO;
import com.sky.dto.CategoryPageQueryDTO;
import com.sky.entity.Category;
import com.sky.exception.DeletionNotAllowedException;
import com.sky.mapper.CategoryMapper;
import com.sky.mapper.DishMapper;
import com.sky.mapper.SetmealMapper;
import com.sky.result.PageResult;
import com.sky.service.CategoryService;

import com.sky.utils.CacheUtils;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

/**
 * 分类业务层
 */
@Service
@Slf4j
//todo手写式写，清缓存
public class CategoryServiceImpl implements CategoryService {
    private static final Random RANDOM = new Random();

    @Autowired
    private CategoryMapper categoryMapper;
    @Autowired
    private DishMapper dishMapper;
    @Autowired
    private SetmealMapper setmealMapper;
    @Autowired
    private StringRedisTemplate stringRedisTemplate;
    @Autowired
    private CacheService cacheService;
    @Autowired
    private CacheUtils cacheUtils;
//    获取锁相关
    @Autowired
    private RedissonClient redissonClient;


    /**
     * 新增分类
     * @param categoryDTO
     */
    public void save(CategoryDTO categoryDTO) {
        Category category = new Category();
        BeanUtils.copyProperties(categoryDTO, category);

        // 设置默认状态
        category.setStatus(StatusConstant.DISABLE);
        // ... 其他设置

        // insert 方法没有返回值，如果失败会抛异常
        // 只要没抛异常，就说明插入成功，可以清理缓存
        categoryMapper.insert(category);
        cacheService.clearCategoryCache();

//        //分类状态默认为禁用状态0
//        category.setStatus(StatusConstant.DISABLE);
//
//        //设置创建时间、修改时间、创建人、修改人
//        //category.setCreateTime(LocalDateTime.now());
//        //category.setUpdateTime(LocalDateTime.now());
//        //category.setCreateUser(BaseContext.getCurrentId());
//        //category.setUpdateUser(BaseContext.getCurrentId());
//
//        categoryMapper.insert(category);
    }

    /**
     * 分页查询
     * @param categoryPageQueryDTO
     * @return
     */
    public PageResult pageQuery(CategoryPageQueryDTO categoryPageQueryDTO) {
        PageHelper.startPage(categoryPageQueryDTO.getPage(),categoryPageQueryDTO.getPageSize());
        //下一条sql进行分页，自动加入limit关键字分页
        Page<Category> page = categoryMapper.pageQuery(categoryPageQueryDTO);
        return new PageResult(page.getTotal(), page.getResult());
    }

    /**
     * 根据id删除分类
     * @param id
     */
//    事务和缓存分离
    public void deleteById(Long id) {
        this.deleteByIdInx(id);
        // 4. 删除成功，清理缓存
        cacheService.clearCategoryCache();//        //查询当前分类是否关联了菜品，如果关联了就抛出业务异常

    }
    @Transactional(rollbackFor = Exception.class)
    public void deleteByIdInx(Long id) {
        Integer count = dishMapper.countByCategoryId(id);
        if (count != null && count > 0) {
            throw new DeletionNotAllowedException(MessageConstant.CATEGORY_BE_RELATED_BY_DISH);
        }

        // 2. 检查是否关联套餐
        count = setmealMapper.countByCategoryId(id);
        if (count != null && count > 0) {
            throw new DeletionNotAllowedException(MessageConstant.CATEGORY_BE_RELATED_BY_SETMEAL);
        }

        // 3. 执行删除
        categoryMapper.deleteById(id);


    }

    /**
     * 修改分类
     * @param categoryDTO
     */
    public void update(CategoryDTO categoryDTO) {
        Category category = new Category();
        BeanUtils.copyProperties(categoryDTO,category);

        //设置修改时间、修改人
        //category.setUpdateTime(LocalDateTime.now());
        //category.setUpdateUser(BaseContext.getCurrentId());

       categoryMapper.update(category);
        cacheService.clearCategoryCache();

    }

    /**
     * 启用、禁用分类
     * @param status
     * @param id
     */
    public void startOrStop(Integer status, Long id) {
        Category category = Category.builder()
                .id(id)
                .status(status)
                //.updateTime(LocalDateTime.now())
                //.updateUser(BaseContext.getCurrentId())
                .build();
        categoryMapper.update(category);
        cacheService.clearCategoryCache();
    }

    /**
     * 根据类型查询分类
     * @param type
     * @return
     */

//    代码健壮性
    public List<Category> list(Integer type) {
        // 1. 根据业务类型构建唯一的 Key，例如 "category_1" 代表菜品分类，"category_2" 代表套餐分类
        String redisKey = "category_" + type;
        String lockKey = "lock:" + redisKey;

        // 2. 先查询 Redis 缓存，看是否已经存在
        try{
            String jsonStr = stringRedisTemplate.opsForValue().get(redisKey);
//        todo防穿透
            // 如果判断出这是一个空标记，直接返回空集合，绝对不去查数据库！
            if (cacheService.isEmptyFlag(jsonStr)) {
                return Collections.emptyList();
            }

            // 3. 缓存命中（有数据），直接将 JSON 字符串反序列化为 List<Category> 返回
            if (jsonStr != null && !jsonStr.isEmpty()) {
                try{
                    return JSON.parseArray(jsonStr, Category.class);
                }catch (Exception e){
                    // 反序列化失败，为了防止 Redis 坏数据阻塞正常流程，直接删除 key 并降级查库
                    stringRedisTemplate.delete(redisKey);
                    log.warn("Redis反序列化失败，Key: {}，将降级查库", redisKey);
                }
            }
        }catch (Exception e) {
            // Redis 彻底挂了或网络异常，安全降级查库
            log.error("Redis查询异常，Key: {}，降级查库", redisKey, e);
        }

        //  缓存未命中，加分布式锁
        RLock lock = redissonClient.getLock(lockKey);
        try {
            boolean acquired = lock.tryLock(2, 5, TimeUnit.SECONDS);

            if (acquired) {
                // 【重点】锁内部的 try-finally 块
                try {
                    String json = stringRedisTemplate.opsForValue().get(redisKey);

// 1. 缓存命中有效数据，直接返回
                    if (json != null && !json.isEmpty()) {
                        try {
                            return JSON.parseArray(json, Category.class);
                        } catch (Exception e) {
                            log.warn("双重检查反序列化失败，Key: {}，降级查库重建", redisKey, e);
                            // 删除坏数据，继续往下查库重建
                            stringRedisTemplate.delete(redisKey);
                        }
                    }

// 2. 缓存命中空标记（防穿透），直接返回空集合，绝不查库
                    if (cacheService.isEmptyFlag(json)) {
                        return Collections.emptyList();
                    }

// 3. json == null，说明缓存仍未重建，继续往下查库
                    return queryDBAndWriteCache(type, redisKey);
                } finally {
                    // 【核心】无论如何，只要拿到锁了，执行完都必须释放
                    lock.unlock();
                }
            } else {
                // 没拿到锁，休眠等待其他线程建好缓存
                Thread.sleep(50);
                String json1 = stringRedisTemplate.opsForValue().get(redisKey);
                if(json1 != null && !json1.isEmpty()){
                    List<Category> retryResult = JSON.parseArray(json1, Category.class);
                    return retryResult;
                }
                return Collections.emptyList();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("获取锁被中断", e);
            return queryDBAndWriteCache(type, redisKey);
        }

    }
    public List<Category> queryDBAndWriteCache(Integer type, String redisKey){
        long baseTtl = 24; // 24
//        todo将小时转成秒，还有加了偏移量
        long ttlWithRandomSecond = cacheUtils.getTtlWithRandom(baseTtl, TimeUnit.HOURS, 121);
        // 4. 缓存未命中，去数据库查询
        List<Category> categoryList = categoryMapper.list(type);

        // 5. 将数据库查出的结果序列化并存入 Redis 缓存，设置过期时间（如60分钟）
        if (categoryList != null && !categoryList.isEmpty()) {
            String jsonString = JSON.toJSONString(categoryList);
            stringRedisTemplate.opsForValue().set(redisKey, jsonString, ttlWithRandomSecond, TimeUnit.SECONDS);
        }
        else {
            // todo：数据库也没数据，存入空标记（防穿透）
            cacheService.setEmptyFlag(redisKey);
        }
        return categoryList != null ? categoryList :Collections.emptyList();
    }
}

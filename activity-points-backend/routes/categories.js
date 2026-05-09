const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

/**
 * GET /api/categories
 * Fetch all categories with subcategories, levels, prizes
 */
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ name: 1 })
      .lean(); // faster + frontend-friendly

    res.status(200).json({ categories });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    res.status(500).json({
      message: 'Server error while fetching categories',
    });
  }
});

/**
 * GET /api/categories/:id
 * Fetch a single category by ID (useful for details view later)
 */
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.status(200).json({ category });
  } catch (error) {
    console.error('Failed to fetch category:', error);
    res.status(500).json({
      message: 'Server error while fetching category',
    });
  }
});

module.exports = router;
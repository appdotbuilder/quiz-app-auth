import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable } from '../db/schema';
import { getQuizQuestionById } from '../handlers/get_quiz_question_by_id';
import { eq } from 'drizzle-orm';

describe('getQuizQuestionById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return quiz question when it exists', async () => {
    // Create prerequisite user and quiz package
    const user = await db.insert(usersTable)
      .values({
        email: 'admin@test.com',
        password_hash: 'hash123',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const quizPackage = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz',
        description: 'Test description',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create test quiz question
    const question = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: quizPackage[0].id,
        question_text: 'What is 2 + 2?',
        option_a: '3',
        option_b: '4',
        option_c: '5',
        option_d: '6',
        option_e: '7',
        correct_answer: 'B',
        order_index: 1
      })
      .returning()
      .execute();

    const result = await getQuizQuestionById(question[0].id);

    // Verify all fields are returned correctly
    expect(result).toBeDefined();
    expect(result!.id).toEqual(question[0].id);
    expect(result!.quiz_package_id).toEqual(quizPackage[0].id);
    expect(result!.question_text).toEqual('What is 2 + 2?');
    expect(result!.option_a).toEqual('3');
    expect(result!.option_b).toEqual('4');
    expect(result!.option_c).toEqual('5');
    expect(result!.option_d).toEqual('6');
    expect(result!.option_e).toEqual('7');
    expect(result!.correct_answer).toEqual('B');
    expect(result!.order_index).toEqual(1);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when quiz question does not exist', async () => {
    const result = await getQuizQuestionById(99999);

    expect(result).toBeNull();
  });

  it('should handle invalid question ID gracefully', async () => {
    const result = await getQuizQuestionById(-1);

    expect(result).toBeNull();
  });

  it('should return complete question data including correct answer for admin operations', async () => {
    // Create prerequisite data
    const user = await db.insert(usersTable)
      .values({
        email: 'teacher@test.com',
        password_hash: 'hash456',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const quizPackage = await db.insert(quizPackagesTable)
      .values({
        title: 'Advanced Quiz',
        description: 'Complex questions',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create question with all options filled
    const question = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: quizPackage[0].id,
        question_text: 'Which programming language is known for its simplicity?',
        option_a: 'Assembly',
        option_b: 'C++',
        option_c: 'Python',
        option_d: 'Machine Code',
        option_e: 'Brainfuck',
        correct_answer: 'C',
        order_index: 5
      })
      .returning()
      .execute();

    const result = await getQuizQuestionById(question[0].id);

    // Verify admin gets full access including correct answer
    expect(result).toBeDefined();
    expect(result!.correct_answer).toEqual('C');
    expect(result!.question_text).toEqual('Which programming language is known for its simplicity?');
    expect(result!.option_c).toEqual('Python');
    expect(result!.order_index).toEqual(5);
    
    // Verify the question exists in database
    const dbQuestion = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.id, question[0].id))
      .execute();
    
    expect(dbQuestion).toHaveLength(1);
    expect(dbQuestion[0].correct_answer).toEqual('C');
  });

  it('should preserve exact question data structure', async () => {
    // Create minimal required data
    const user = await db.insert(usersTable)
      .values({
        email: 'creator@test.com',
        password_hash: 'pass123',
        role: 'USER'
      })
      .returning()
      .execute();

    const quizPackage = await db.insert(quizPackagesTable)
      .values({
        title: 'Basic Quiz',
        description: null,
        created_by: user[0].id
      })
      .returning()
      .execute();

    const questionData = {
      quiz_package_id: quizPackage[0].id,
      question_text: 'Select the odd one out:',
      option_a: 'Apple',
      option_b: 'Banana',
      option_c: 'Cherry',
      option_d: 'Dog',
      option_e: 'Elderberry',
      correct_answer: 'D' as const,
      order_index: 10
    };

    const question = await db.insert(quizQuestionsTable)
      .values(questionData)
      .returning()
      .execute();

    const result = await getQuizQuestionById(question[0].id);

    // Ensure exact data preservation
    expect(result).toBeDefined();
    expect(result!.quiz_package_id).toEqual(questionData.quiz_package_id);
    expect(result!.question_text).toEqual(questionData.question_text);
    expect(result!.option_a).toEqual(questionData.option_a);
    expect(result!.option_b).toEqual(questionData.option_b);
    expect(result!.option_c).toEqual(questionData.option_c);
    expect(result!.option_d).toEqual(questionData.option_d);
    expect(result!.option_e).toEqual(questionData.option_e);
    expect(result!.correct_answer).toEqual(questionData.correct_answer);
    expect(result!.order_index).toEqual(questionData.order_index);
  });
});
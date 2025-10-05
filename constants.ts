import { Problem, LeaderboardEntry, SolvedProblem } from './types';

export const PROBLEMS: Problem[] = [
  {
  id: 1,
  statement: "All the angles of the hexagon $ABCDEF$ are equal. Prove that \\[AB-DE=EF-BC=CD-FA \\]",
  topic: "Geometry",
  hints: [
    "Determine the measure of each interior angle of an equiangular hexagon. What is the sum of its vectors representing its sides?",
    "Based on the interior angles, how are the directions of opposite sides of the hexagon related? For example, what is the angle between the vector $\\vec{AB}$ and the vector $\\vec{DE}$?",
    "Represent the sides as vectors $\\vec{v_1}, \\vec{v_2}, \\dots, \\vec{v_6}$. Since it's a closed polygon, their sum is $\\vec{0}$. Use the directional relationships between opposite side vectors (e.g., $\\vec{v_1}$ and $\\vec{v_4}$) to simplify this vector sum and derive the desired equalities."
  ],
  difficulty: 5,
},
  {
    id: 2,
    statement: "Find all positive integers $n$ such that $n^2 + 1$ is divisible by $n + 1$.",
    topic: "Number Theory",
    hints: [
      "Try to use polynomial long division or algebraic manipulation on the expression $(n^2 + 1) / (n + 1)$.",
      "Rewrite the numerator $n^2 + 1$ as $(n^2 - 1) + 2$. Notice that $n^2 - 1$ is divisible by $n + 1$.",
      "The expression simplifies to $(n - 1) + 2/(n + 1)$. For this to be an integer, $n + 1$ must be a divisor of 2. Since $n$ is positive, $n + 1$ can be 1 or 2. This means $n=0$ (not positive) or $n=1$. The only solution is $n=1$."
    ],
    difficulty: 2,
  },
  {
    id: 3,
    statement: "Find the number of ordered pairs of integers $(x, y)$ such that $x^2 + y^2 = 2024$.",
    topic: "Number Theory",
    hints: [
        "Consider the equation modulo 4. The square of any integer is congruent to either $0$ or $1 \\pmod{4}$.",
        "The sum of two squares, $x^2 + y^2$, can therefore only be congruent to $0, 1$, or $2 \\pmod{4}$. What is $2024 \\pmod{4}$?",
        "$2024$ is divisible by 4, so $2024 \\equiv 0 \\pmod{4}$. This requires $x^2 \\equiv 0 \\pmod{4}$ and $y^2 \\equiv 0 \\pmod{4}$, which means both $x$ and $y$ must be even. Let $x=2a, y=2b$ and substitute this back into the equation. You'll get $a^2+b^2 = 506$. Repeat the process. You'll find there are no integer solutions, so the number of pairs is 0."
    ],
    difficulty: 4,
  },
  {
    id: 4,
    statement: "In a group of 10 people, every person has exactly 3 friends. (Friendship is mutual). Prove that it is possible to select 4 people and seat them at a round table so that every two neighbors are friends.",
    topic: "Combinatorics",
    hints: [
      "This structure can be modeled as a 3-regular graph with 10 vertices. The problem is asking to prove the existence of a cycle of length 4 (a $C_4$).",
      "Pick an arbitrary vertex $v$. It has three neighbors: $n_1, n_2$, and $n_3$. Consider the neighbors of $n_1$ (other than $v$). If any two of $n_1$'s neighbors are also neighbors of each other, what does that form?",
      "Pick a vertex $v$ and its neighbor $u$. $v$ has two other neighbors ($v_1, v_2$) and $u$ has two other neighbors ($u_1, u_2$). If any of $v$'s 'other' neighbors is the same as $u$'s 'other' neighbors (e.g., $v_1=u_1$), a $C_4$ is formed ($v-u-u_1-v_1-v$). It can be proven this must occur in any 3-regular graph of this size."
    ],
    difficulty: 5,
  },
  {
    id: 5,
    statement: "Let $\\frac{x^2+y^2}{x^2-y^2} + \\frac{x^2-y^2}{x^2+y^2} = k$. Compute the following expression in terms of $k$: $ E(x,y) = \\frac{x^8 + y^8}{x^8-y^8} - \\frac{ x^8-y^8}{x^8+y^8}. $",
    topic: "Algebra",
    hints: [
      "Let $u_n = \\frac{x^{2^n}+y^{2^n}}{x^{2^n}-y^{2^n}}$. Identify the terms in the given equation and the expression to compute using this notation.",
      "Derive a relationship between $u_{m+1}$ and $u_m$. Specifically, show that $u_{m+1} = \\frac{1}{2} \\left(u_m + \\frac{1}{u_m}\\right)$.",
      "Use the derived recurrence relation to find $u_2$ and $u_3$ in terms of $k$. Then compute $u_3 - \\frac{1}{u_3}$ and simplify the result using algebraic identities like the difference of squares."
    ],
    difficulty: 7,
  },
  {
    id: 6,
    statement: "Find all functions $f: \\mathbb{R} \\to \\mathbb{R}$ such that $f(x + y) - f(x - y) = 4xy$ for all $x, y \\in \\mathbb{R}$.",
    topic: "Algebra",
    hints: [
        "This is a known functional equation. Start by substituting specific values. What happens if $x=0$?",
        "Setting $x=0$ gives $f(y) - f(-y) = 0$, which means $f(y) = f(-y)$, so the function is even. Now, try setting $y=x$.",
        "Setting $y=x$ gives $f(2x) - f(0) = 4x^2$. If we let $u=x+y$ and $v=x-y$, we can show that $f(u) - u^2 = f(v) - v^2$ for any $u,v$. This implies $f(x) - x^2 = C$ for some constant $C$. So, $f(x) = x^2 + C$. Verify this solution in the original equation."
    ],
    difficulty: 6,
  },
  {
  id: 7,
  statement: "Show that given any 9 points inside a square of side 1 we can always find 3 which form a triangle with area less than $\\frac 18$.",
  topic: "Combinatorics",
  hints: [
    "Consider dividing the square of side 1 into 4 smaller, equal squares. How many points would need to be in one of these smaller squares, based on the total number of points?",
    "Apply the Pigeonhole Principle to distribute the 9 points among the regions you've created. What is the minimum number of points guaranteed to be in at least one region?",
    "If 3 points are contained within a square of side 's', what is the maximum possible area of the triangle formed by these three points? (Recall that the maximum area of a triangle inside a rectangle is half the area of the rectangle)."
  ],
  difficulty: 4,
},
{
  "id": 8,
  "statement": "Determine the triangle with sides $a,b,c$ and circumradius $R$ for which $R(b+c) = a\\sqrt{bc}$.",
  "topic": "Algebra",
  "hints": [
    "Express the sides $a, b, c$ in terms of the circumradius $R$ and the angles $A, B, C$ using the Sine Rule (e.g., $a = 2RsinA$). Substitute these expressions into the given equation.",
    "Simplify the resulting trigonometric equation. You should be able to cancel $R$ and rearrange the terms to get an expression involving a sum of a variable and its reciprocal, for example, $\\sqrt{\\frac{\\sin B}{\\sin C}} + \\sqrt{\\frac{\\sin C}{\\sin B}} = 2\\sin A$.",
    "Apply the AM-GM inequality (or the property that for positive $x$, $x + 1/x \\ge 2$) to the simplified expression. This will help determine the value of $\\sin A$ and the relationship between $\\sin B$ and $\\sin C$, leading to the specific angles of the triangle."
  ],
  difficulty: 5,
},
{
  "id": 9,
  "statement": "It is given $n$ positive integers. Product of any one of them with sum of remaining numbers increased by $1$ is divisible with sum of all $n$ numbers. Prove that sum of squares of all $n$ numbers is divisible with sum of all $n$ numbers",
  "topic": "Number Theory",
  "hints": [
    "Let $S$ be the sum of all $n$ numbers. The given condition is $S | a_i((S - a_i) + 1)$ for any $a_i$. Expand this expression and simplify it using properties of modular arithmetic.",
    "Once you have simplified the condition for each $a_i$ to the form $a_i^2 \equiv a_i \pmod S$, consider what happens if you sum this congruence over all $n$ integers.",
    "Recall that $S = \sum_{i=1}^n a_i$. Use this definition to relate the sum of squares modulo $S$ to $S$ itself."
  ],
  difficulty: 5,
},
{
  id: 10,
  statement: "Let $k>1$ be a positive integer and $n>2018$ an odd positive integer. The non-zero rational numbers $x_1,x_2,\\ldots,x_n$ are not all equal and: $x_1+\\frac{k}{x_2}=x_2+\\frac{k}{x_3}=x_3+\\frac{k}{x_4}=\\ldots=x_{n-1}+\\frac{k}{x_n}=x_n+\\frac{k}{x_1}$. Find the minimum value of $k$, such that the above relations hold.",
  topic: "Algebra",
  hints: [
    "Let the common value of the expressions be $C$. Rewrite the relation $x_i + \\frac{k}{x_{i+1}} = C$ as a recurrence relation $x_{i+1} = \\frac{k}{C-x_i}$. What can you deduce about $C$ if $x_i$ are rational?",
    "Consider the fixed points of the recurrence relation $x = \\frac{k}{C-x}$, which are the roots $\\alpha, \\beta$ of $t^2 - Ct + k = 0$. Transform the recurrence into $y_{i+1} = \\frac{\\alpha}{\\beta} y_i$ using $y_i = \\frac{x_i-\\alpha}{x_i-\\beta}$. Since $x_{n+1}=x_1$, what condition must $y_1$ satisfy?",
    "Since $x_i$ are rational, analyze the conditions on $\\alpha, \\beta$ and $y_i = \\frac{x_i-\\alpha}{x_i-\\beta}$ to ensure $x_i$ are rational. This implies $|y_i|=1$. The condition $(\\alpha/\\beta)^n=1$ then implies that $\\alpha/\\beta$ must be a root of unity. Use Niven's Theorem, which states that if $\\theta/\\pi$ and $\\cos(\\theta)$ are both rational, then $\\cos(\\theta) \\in \\{0, \\pm 1/2, \\pm 1\\}$, to narrow down the possibilities for $k$ and $C$."
  ],
  difficulty: 7,
},
{
  id: 11,
  statement: "Let $\\Gamma$ be the circumcircle of acute triangle $ABC$. Points $D$ and $E$ are on segments $AB$ and $AC$ respectively such that $AD = AE$. The perpendicular bisectors of $BD$ and $CE$ intersect minor arcs $AB$ and $AC$ of $\\Gamma$ at points $F$ and $G$ respectively. Prove that lines $DE$ and $FG$ are either parallel or they are the same line.",
  topic: "Geometry",
  hints: [
    "Since $AD=AE$, the triangle $ADE$ is isosceles. Consider the relationship between line $DE$ and the angle bisector of $\\angle BAC$.",
    "The point $F$ is on the circumcircle $\\Gamma$ and on the perpendicular bisector of $BD$, which implies $FB=FD$. Similarly, $GC=GE$. What do these equalities imply about angles related to $F$ and $G$?",
    "To prove that lines $DE$ and $FG$ are parallel (or identical), show that both are perpendicular to the angle bisector of $\\angle BAC$. This can be achieved by proving that $AF=AG$."
  ],
  difficulty: 9,
}

];

export const LEADERBOARD_DATA: LeaderboardEntry[] = [
  { rank: 1, name: "Alexandre P.", score: 4200, country: "FRA" },
  { rank: 2, name: "Yuhan Z.", score: 4150, country: "CHN" },
  { rank: 3, name: "Ben C.", score: 3980, country: "USA" },
  { rank: 4, name: "Danila M.", score: 3800, country: "RUS" },
  { rank: 5, name: "Linh N.", score: 3750, country: "VNM" },
  { rank: 6, name: "David E.", score: 3600, country: "ROU" },
  { rank: 7, name: "Sarah K.", score: 3450, country: "DEU" },
  { rank: 8, name: "Mateo G.", score: 3300, country: "ESP" },
  { rank: 9, name: "Olga P.", score: 3210, country: "POL" },
  { rank: 10, name: "Kenji T.", score: 3100, country: "JPN" },
];

// Temporary data for testing the progress page without logging in
export const DUMMY_SOLVED_PROBLEMS: SolvedProblem[] = [
  {
    problem: PROBLEMS[1], // Number Theory
    timeSpent: 320,
    difficultyRating: 4,
    solvedAt: new Date('2024-07-20T10:00:00Z'),
  },
  {
    problem: PROBLEMS[0], // Geometry
    timeSpent: 650,
    difficultyRating: 7,
    solvedAt: new Date('2024-07-21T11:30:00Z'),
  },
  {
    problem: PROBLEMS[4], // Algebra (was Inequalities)
    timeSpent: 210,
    difficultyRating: 3,
    solvedAt: new Date('2024-07-22T09:00:00Z'),
  },
  {
    problem: PROBLEMS[3], // Combinatorics
    timeSpent: 800,
    difficultyRating: 8,
    solvedAt: new Date('2024-07-22T15:45:00Z'),
  },
  {
    problem: PROBLEMS[2], // Number Theory
    timeSpent: 450,
    difficultyRating: 6,
    solvedAt: new Date('2024-07-23T14:00:00Z'),
  },
  {
    problem: PROBLEMS[5], // Algebra (was Functional Equations)
    timeSpent: 512,
    difficultyRating: 7,
    solvedAt: new Date('2024-07-24T18:00:00Z'),
  },
  {
    problem: PROBLEMS[1], // Number Theory again
    timeSpent: 180,
    difficultyRating: 2,
    solvedAt: new Date('2024-07-25T10:20:00Z'),
  }
];